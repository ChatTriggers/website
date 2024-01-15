import { db, releases, utils } from "db";
import { BadQueryParamError, ClientError } from "db/utils/errors";
import type { SlugProps } from "db/utils/route";
import { getSessionFromCookies } from "db/utils/session";
import { and, desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import VerifyComponent from "./VerifyComponent";

export default async function Page({ params }: SlugProps<"nameOrId" | "releaseId">) {
  const session = getSessionFromCookies(cookies());
  if (!session || session.rank === "default") notFound();

  const releaseId = parseInt(params.releaseId);
  if (isNaN(releaseId)) throw new BadQueryParamError("releaseId", params.releaseId);

  const module_ = await utils.modules.getOne(params.nameOrId);
  if (!module_) throw new ClientError(`Unknown module name or ID ${params.nameOrId}`);

  const release = module_.releases.find(r => r.id === releaseId);
  if (!release) throw new ClientError(`Unknown release ID ${releaseId}`);

  const oldRelease = await db.query.releases.findFirst({
    where: and(eq(releases.moduleId, module_.id), eq(releases.verified, false)),
    orderBy: desc(releases.releaseVersion),
  });

  return (
    <VerifyComponent
      module={utils.pub.fromModule(module_, false)}
      release={utils.pub.fromRelease(release)}
      oldRelease={oldRelease && utils.pub.fromRelease(oldRelease)}
    />
  );
}
