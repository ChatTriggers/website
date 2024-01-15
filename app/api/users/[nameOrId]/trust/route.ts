import { db, users } from "db";
import { ForbiddenError } from "db/utils/errors";
import type { SlugProps } from "db/utils/route";
import { route } from "db/utils/route";
import { getSessionFromRequest } from "db/utils/session";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const POST = route(async (req: NextRequest, { params }: SlugProps<"nameOrId">) => {
  const sessionUser = getSessionFromRequest(req);
  if (!sessionUser || sessionUser.rank !== "admin") throw new ForbiddenError("No permission");

  const maybeId = parseInt(params.nameOrId);
  const user = await db.query.users.findFirst({
    where: isNaN(maybeId) ? eq(users.name, params.nameOrId) : eq(users.id, maybeId),
  });

  if (!user) return new Response("User not found", { status: 404 });

  if (user.rank === "default") user.rank = "trusted";
  else if (user.rank === "trusted") user.rank = "default";

  await db
    .update(users)
    .set({ rank: user.rank === "trusted" ? "default" : "trusted" })
    .where(eq(users.id, user.id));

  return Response.json({ newRank: user.rank });
});
