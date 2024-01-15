import * as users from "app/api/users";
import { db, utils } from "db";
import { notifications, releases } from "db/schema";
import { ClientError, ConflictError, NotAuthenticatedError, NotFoundError } from "db/utils/errors";
import type { SlugProps } from "db/utils/route";
import { getFormData, getFormEntry, route } from "db/utils/route";
import { getSessionFromRequest } from "db/utils/session";
import { deleteReleaseVerificationMessage } from "db/utils/webhooks";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export const POST = route(async (req, { params }: SlugProps<"nameOrId" | "releaseId">) => {
  const releaseId = parseInt(params.releaseId);
  if (isNaN(releaseId)) notFound();

  const session = getSessionFromRequest(req);
  if (!session || session.rank === "default") throw new NotAuthenticatedError("No permission");
  const sessionUser = await users.getUser(session.id);
  if (!sessionUser) throw new NotAuthenticatedError("No permission");

  const module_ = await utils.modules.getOne(params.nameOrId);
  if (!module_) throw new NotFoundError("Invalid module");

  const release = module_.releases.find(r => r.id === releaseId);
  if (!release) throw new NotFoundError("Invalid release");

  if (release.verified) throw new ConflictError("Release is already verified");

  const form = await getFormData(req);
  const verified = getFormEntry({ form, name: "verified", type: "boolean" });
  const reason = getFormEntry({ form, name: "reason", type: "string", optional: true });

  if (!verified && !reason) throw new ClientError("Must include a reason when rejecting a release");

  const notification: typeof notifications.$inferInsert = {
    userId: module_.user.id,
    title: `Release v${release.releaseVersion} for module ${module_.name} has been ${
      verified ? "verified" : "reject"
    }`,
  };

  if (verified) {
    await db
      .update(releases)
      .set({ verified: true, verifiedBy: sessionUser.id, verifiedAt: new Date() })
      .where(eq(releases.id, release.id));
  } else {
    notification.description =
      "Your release has been rejected, as it is not suitable for publication. If you have any questions, " +
      "please contact us on our Discord server.\n\nReason given for rejection: " +
      reason;

    await db.delete(releases).where(eq(releases.id, release.id));
  }

  deleteReleaseVerificationMessage(release);

  await db.insert(notifications).values(notification);

  if (verified) return new Response("Release verified");
  return new Response("Release rejected");
});
