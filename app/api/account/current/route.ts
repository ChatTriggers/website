import { db, users, utils } from "db";
import { NotAuthenticatedError, ServerError } from "db/utils/errors";
import { route } from "db/utils/route";
import { getSessionFromRequest } from "db/utils/session";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const GET = route(async (req: NextRequest) => {
  const session = getSessionFromRequest(req);
  if (!session) throw new NotAuthenticatedError();
  const user = await db.query.users.findFirst({ where: eq(users.id, session.id) });
  if (!user) throw new ServerError(`Failed to find session with it ${session.id}`);
  return Response.json(utils.pub.fromUser(user, session.id === user.id));
});
