import * as modules from "app/api/modules";
import { BadQueryParamError, MissingQueryParamError, NotFoundError } from "db/utils/errors";
import { getMetadata } from "db/utils/releases";
import type { SlugProps } from "db/utils/route";
import { route } from "db/utils/route";
import Version from "db/utils/Version";
import type { NextRequest } from "next/server";

export const GET = route(async (req: NextRequest, { params }: SlugProps<"nameOrId">) => {
  const searchParams = req.nextUrl.searchParams;

  const existingModule = await modules.getOne(params.nameOrId);
  if (!existingModule) throw new NotFoundError("Module not found");

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

  const matchingRelease = await modules.findMatchingRelease(
    existingModule,
    modVersion,
    gameVersions,
  );
  if (!matchingRelease) throw new NotFoundError("No matching release found");

  const buffer = await getMetadata(existingModule, matchingRelease.id);
  return new Response(buffer?.toString("utf-8"), {
    headers: { "Content-Type": "application/json" },
  });
});
