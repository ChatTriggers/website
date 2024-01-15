import { db, releases, utils } from "db";
import { ForbiddenError, NotFoundError } from "db/utils/errors";
import type { SlugProps } from "db/utils/route";
import { route } from "db/utils/route";
import { getSessionFromRequest } from "db/utils/session";
import { deleteReleaseVerificationMessage } from "db/utils/webhooks";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";

export const DELETE = route(
  async (req: NextRequest, { params }: SlugProps<"nameOrId" | "releaseId">) => {
    const session = getSessionFromRequest(req);
    if (!session) throw new ForbiddenError("No permission to delete this release");

    const module_ = await utils.modules.getOne(params.nameOrId, session);
    if (!module_) throw new NotFoundError("Module not found");

    if (module_.user.id !== session.id && session.rank === "default")
      throw new ForbiddenError("No permission to delete this release");

    const releaseId = parseInt(params.releaseId);
    if (isNaN(releaseId)) notFound();
    const release = await db.query.releases.findFirst({ where: eq(releases.id, releaseId) });
    if (!release) notFound();

    deleteReleaseVerificationMessage(release);
    await db.delete(releases).where(eq(releases.id, releaseId));

    return new Response("Deleted release");
  },
);
