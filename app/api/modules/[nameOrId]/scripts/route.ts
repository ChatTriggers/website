import { utils } from "db";
import { BadQueryParamError, MissingQueryParamError, NotFoundError } from "db/utils/errors";
import { getScripts } from "db/utils/releases";
import type { SlugProps } from "db/utils/route";
import { route } from "db/utils/route";
import Version from "db/utils/Version";
import type { NextRequest } from "next/server";

export const GET = route(async (req: NextRequest, { params }: SlugProps<"nameOrId">) => {
  const searchParams = req.nextUrl.searchParams;

  const modVersionStr = searchParams.get("modVersion");
  if (!modVersionStr) throw new MissingQueryParamError("modVersion");
  const modVersion = Version.parse(modVersionStr);
  if (!modVersion) throw new BadQueryParamError("modVersion", modVersionStr);

  const gameVersions = searchParams
    .get("gameVersions")
    ?.split(",")
    ?.map(str => {
      const v = Version.parse(str);
      if (!v) throw new BadQueryParamError("gameVersions", str);
      return v;
    });

  if (!gameVersions || gameVersions.length === 0) throw new MissingQueryParamError("gameVersion");

  const existingModule = await utils.modules.getOne(params.nameOrId);
  if (!existingModule) throw new NotFoundError("Module not found");

  const matchingRelease = await utils.releases.findMatchingRelease(
    existingModule,
    modVersion,
    gameVersions,
  );
  if (!matchingRelease) throw new NotFoundError("Release not found");

  const buffer = await getScripts(existingModule, matchingRelease.id);
  return new Response(buffer?.toString("utf-8"), {
    headers: { "Content-Type": "application/zip" },
  });
});
