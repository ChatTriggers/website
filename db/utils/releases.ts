import { ClientError } from "app/api";
import Version from "app/api/(utils)/Version";
import type { Module, Release } from "db";
import { db, modules, releases, utils } from "db";
import { eq } from "drizzle-orm";
import * as fs from "fs/promises";

export async function findMatchingRelease(
  module: Module,
  modVersion: Version,
  gameVersions: Version[],
): Promise<Release | undefined> {
  const records = (await db.select().from(releases).where(eq(modules.id, releases.moduleId))).map(
    release => ({
      release,
      releaseVersion: Version.parse(release.releaseVersion)!,
      modVersion: Version.parse(release.modVersion)!,
      gameVersions: release.gameVersions.split(",").map(Version.parse) as Version[],
    }),
  );

  records.sort((r1, r2) => {
    const releaseComparison = r1.releaseVersion.compare(r2.releaseVersion);
    if (releaseComparison !== 0) return releaseComparison;
    return r1.modVersion.compare(r2.modVersion);
  });

  for (const release of records) {
    if (release.modVersion.major > modVersion.major) continue;
    if (
      gameVersions.some(gameVersion =>
        release.gameVersions.some(
          releaseGameVersion => releaseGameVersion.compare(gameVersion) === 0,
        ),
      )
    )
      return release.release;
  }
}

export async function getScripts(
  moduleOrId: Module | number,
  releaseId: number,
): Promise<Buffer | undefined> {
  if (typeof moduleOrId === "number") {
    const result = await utils.modules.getOne(moduleOrId);
    if (!result) throw new ClientError(`Unknown module name or ID ${moduleOrId}`);
    return getScripts(result, releaseId);
  }

  const result = await db.query.releases.findFirst({ where: eq(releases.id, releaseId) });
  if (!result) return;

  const [buffer] = await Promise.all([
    fs.readFile(`storage/${moduleOrId.name}/${releaseId}/scripts.zip`),
    db
      .update(modules)
      .set({ downloads: moduleOrId.downloads + 1 })
      .where(eq(modules.id, moduleOrId.id)),
    db
      .update(releases)
      .set({ downloads: result.downloads + 1 })
      .where(eq(releases.id, releaseId)),
  ]);

  return buffer;
}

export async function getMetadata(
  moduleOrId: Module | number,
  releaseId: number,
): Promise<Buffer | undefined> {
  if (typeof moduleOrId === "number") {
    const result = await utils.modules.getOne(moduleOrId);
    if (!result) throw new ClientError(`Unknown module name or ID ${moduleOrId}`);
    return getMetadata(result, releaseId);
  }

  const result = await db.query.releases.findFirst({ where: eq(releases.id, releaseId) });
  if (result) return fs.readFile(`storage/${moduleOrId.name}/${releaseId}/metadata.json`);
}
