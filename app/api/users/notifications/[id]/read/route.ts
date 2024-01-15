import { db, notifications } from "db";
import {
  BadQueryParamError,
  ClientError,
  ForbiddenError,
  NotAuthenticatedError,
} from "db/utils/errors";
import type { SlugProps } from "db/utils/route";
import { route } from "db/utils/route";
import { getSessionFromRequest } from "db/utils/session";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const PATCH = route(async (req: NextRequest, { params }: SlugProps<"id">) => {
  const session = getSessionFromRequest(req);
  if (!session) throw new NotAuthenticatedError();

  const id = parseInt(params.id);
  if (isNaN(id)) throw new BadQueryParamError("id", params.id);

  const notification = await db.query.notifications.findFirst({ where: eq(notifications.id, id) });
  if (!notification) throw new ClientError(`Could not find notification with id ${id}`);
  if (notification.userId !== session.id) throw new ForbiddenError();

  await db.update(notifications).set({ read: true }).where(eq(notifications.id, id));

  return new Response("Marked notification as read");
});
