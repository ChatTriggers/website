import type { ModuleWithRelations } from "db";
import { db, releases, utils } from "db";
import {
  BadQueryParamError,
  ClientError,
  ConflictError,
  ForbiddenError,
  NotAuthenticatedError,
  NotFoundError,
} from "db/utils/errors";
import type { SlugProps } from "db/utils/route";
import { getAllowedVersions, getFormData, getFormEntry, route } from "db/utils/route";
import { getSessionFromRequest } from "db/utils/session";
import Version from "db/utils/Version";
import { and, eq } from "drizzle-orm";
import * as fs from "fs/promises";
import JSZip from "jszip";
import type { NextRequest } from "next/server";

export const PUT = route(async (req: NextRequest, { params }: SlugProps<"nameOrId">) => {
  const session = getSessionFromRequest(req);
  if (!session) throw new NotAuthenticatedError();

  const module_ = await utils.modules.getOne(params.nameOrId, session);
  if (!module_) throw new NotFoundError("Module not found");

  if (session.id !== module_.user.id && session.rank === "default")
    throw new ForbiddenError("No permission");

  const form = await getFormData(req);

  const releaseVersion = getFormEntry({ form, name: "releaseVersion", type: "string" });
  if (!Version.parse(releaseVersion))
    throw new BadQueryParamError("releaseVersion", releaseVersion);

  const modVersion = getFormEntry({ form, name: "modVersion", type: "string" });
  const allAllowedVersions = (await getAllowedVersions()).modVersions;
  if (!(modVersion in allAllowedVersions)) throw new BadQueryParamError("modVersion", modVersion);
  const allowedGameVersions = (allAllowedVersions as Record<string, string[]>)[modVersion];
  if (!allowedGameVersions) throw new BadQueryParamError("modVersion", modVersion);

  const gameVersions = getFormEntry({ form, name: "gameVersions", type: "string" }).split(",");
  gameVersions.forEach(str => {
    if (!allowedGameVersions.includes(str)) throw new BadQueryParamError("gameVersions", str);
  });

  const existingRelease = await db.query.releases.findFirst({
    where: and(eq(releases.moduleId, module_.id), eq(releases.releaseVersion, releaseVersion)),
  });

  if (existingRelease)
    throw new ConflictError(`Release with version ${releaseVersion} already exists`);

  const changelog = getFormEntry({ form, name: "changelog", type: "string", optional: true });

  const release: typeof releases.$inferInsert = {
    moduleId: module_.id,
    releaseVersion: releaseVersion,
    modVersion: modVersion,
    gameVersions: gameVersions.join(","),
    changelog: changelog ?? null,
    verified: session.rank !== "default",
  };

  const zipFile = getFormEntry({ form, name: "module", type: "file" });
  await saveZipFile(module_, release, zipFile);

  if (!module_.hidden && release.verified) utils.webhooks.onReleaseCreated(module_, release);

  if (!release.verified) await utils.webhooks.onReleaseNeedsToBeVerified(module_, release);

  await db.insert(releases).values(release);

  return new Response("Release created", { status: 201 });
});

async function saveZipFile(
  module: ModuleWithRelations,
  release: typeof releases.$inferInsert,
  zipFile: File,
): Promise<void> {
  const releaseFolder = `storage/${module.name.toLowerCase()}/${release.id}`;
  await fs.mkdir(releaseFolder, { recursive: true });

  try {
    let zip = await JSZip.loadAsync(await zipFile.arrayBuffer());

    // If the user uploaded a zip file with a single directory, we need to unwrap it
    const singleDir = zip.folder(module.name);
    if (singleDir) zip = singleDir;

    const metadataFile = zip.file("metadata.json");
    if (!metadataFile) throw new ClientError("zip file has no metadata.json file");

    // Normalize the metadata file
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let metadata: any;
    try {
      metadata = JSON.parse(await metadataFile.async("text"));
    } catch {
      throw new ClientError("Invalid metadata.json file");
    }

    metadata.name = module.name;
    metadata.version = release.releaseVersion;
    metadata.tags = module.tags?.length ? module.tags : undefined;
    if (module.image) {
      metadata.pictureLink = `${process.env.NEXT_PUBLIC_WEB_ROOT!}/${module.image}`;
    } else {
      delete metadata.pictureLink;
    }
    metadata.creator = module.user.name;
    delete metadata.author;
    metadata.description = module.description;
    metadata.changelog = release.changelog ?? undefined;

    const metadataStr = JSON.stringify(metadata, null, 2);

    zip.remove("metadata.json");
    zip.file("metadata.json", metadataStr);

    // Save to storage folder
    await fs.writeFile(
      `${releaseFolder}/scripts.zip`,
      await zip.generateAsync({ type: "uint8array" }),
    );

    // Also save the metadata file separately for quick access
    await fs.writeFile(`${releaseFolder}/metadata.json`, metadataStr);
  } catch (e) {
    await fs.rm(releaseFolder, { recursive: true });
    throw e;
  }
}
