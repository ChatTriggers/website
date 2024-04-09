import type { SlugProps } from "app/(utils)/next";
import {
  BadQueryParamError,
  ClientError,
  ConflictError,
  ForbiddenError,
  getFormData,
  getFormEntry,
  getSessionFromRequest,
  NotAuthenticatedError,
  NotFoundError,
  route,
} from "app/api";
import { getAllowedVersions } from "app/api";
import Version from "app/api/(utils)/Version";
import { onReleaseCreated, onReleaseNeedsToBeVerified } from "app/api/(utils)/webhooks";
import type { Module } from "app/api/db";
import { getDb, Rank, Release } from "app/api/db";
import * as modules from "app/api/modules";
import { randomUUID } from "crypto";
import * as fs from "fs/promises";
import JSZip from "jszip";
import type { NextRequest } from "next/server";

export const PUT = route(async (req: NextRequest, { params }: SlugProps<"nameOrId">) => {
  const sessionUser = getSessionFromRequest(req);
  if (!sessionUser) throw new NotAuthenticatedError();

  const existingModule = await modules.getOne(params.nameOrId, sessionUser);
  if (!existingModule) throw new NotFoundError("Module not found");

  if (sessionUser.id !== existingModule.user.id && sessionUser.rank === Rank.DEFAULT)
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

  const db = await getDb();
  const releaseRepo = db.getRepository(Release);

  const existingRelease = await releaseRepo.findOneBy({
    module: {
      id: existingModule.id,
    },
    release_version: releaseVersion,
  });

  if (existingRelease)
    throw new ConflictError(`Release with version ${releaseVersion} already exists`);

  const changelog = getFormEntry({ form, name: "changelog", type: "string", optional: true });

  const release = new Release();
  release.id = randomUUID();
  release.module = existingModule;
  release.release_version = releaseVersion;
  release.mod_version = modVersion;
  release.game_versions = gameVersions;
  release.changelog = changelog ?? null;
  release.verified = sessionUser.rank !== Rank.DEFAULT;

  const zipFile = getFormEntry({ form, name: "module", type: "file" });
  await saveZipFile(existingModule, release, zipFile);

  if (!existingModule.hidden && release.verified) onReleaseCreated(existingModule, release);

  if (!release.verified) await onReleaseNeedsToBeVerified(existingModule, release);

  releaseRepo.save(release);

  return new Response("Release created", { status: 201 });
});

async function saveZipFile(module: Module, release: Release, zipFile: File): Promise<void> {
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
    metadata.version = release.release_version;
    metadata.tags = module.tags.length ? module.tags : undefined;
    if (release.module.image) {
      metadata.pictureLink = `${process.env.NEXT_PUBLIC_WEB_ROOT!}/${release.module.image}`;
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
