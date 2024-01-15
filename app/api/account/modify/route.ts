import { db, users, utils } from "db";
import { ClientError, ConflictError, NotAuthenticatedError, ServerError } from "db/utils/errors";
import type { AuthenticatedUser } from "db/utils/pub";
import { getFormData, getFormEntry, route } from "db/utils/route";
import { getSessionFromRequest, setSession } from "db/utils/session";
import { eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

import { saveImage } from "..";

const SECONDS_PER_MONTH = 60 * 60 * 24 * 30;

export const POST = route(async (req: NextRequest) => {
  const session = getSessionFromRequest(req);
  if (!session) throw new NotAuthenticatedError();

  const form = await getFormData(req);
  const username = getFormEntry({ form, name: "username", type: "string", optional: true });
  const image = getFormEntry({ form, name: "image", type: "file", optional: true });
  if (!username && !image) return new Response();

  const user = await db.query.users.findFirst({ where: eq(users.id, session.id) });
  if (!user) throw new ServerError("No user corresponding to existing session");

  if (username) {
    if (user.lastNameChangeTime) {
      const diff = new Date().getTime() - user.lastNameChangeTime.getTime();
      if (diff < SECONDS_PER_MONTH)
        throw new ClientError("Cannot change username more than once every 30 days");
    }

    const existingUser = await db.query.users.findFirst({
      where: sql`lower(users.name) like lower(${username})`,
    });
    if (existingUser) throw new ConflictError("Username already taken");

    user.name = username;
    user.lastNameChangeTime = new Date();
  }
  if (image) user.image = await saveImage(user.name, image);

  await db.update(users).set(user).where(eq(users.id, user.id));

  if (username) {
    // Update the session if the username changes
    const authedUser = utils.pub.fromUser(user, true) as AuthenticatedUser;
    const response = NextResponse.json(authedUser);
    setSession(response, authedUser);
    return response;
  }

  return new Response();
});
