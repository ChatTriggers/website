import { isPasswordValid } from "app/constants";
import bcrypt from "bcrypt";
import { db, users } from "db";
import { ClientError } from "db/utils/errors";
import { getFormData, getFormEntry, route } from "db/utils/route";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const POST = route(async (req: NextRequest) => {
  const form = await getFormData(req);
  const email = getFormEntry({ form, name: "email", type: "string" });
  const password = getFormEntry({ form, name: "password", type: "string" });
  const token = getFormEntry({ form, name: "token", type: "string" });

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });

  // Intentionally vague errors so a user can't use this endpoint to query email addresses
  if (!user) throw new ClientError("Invalid email or token");
  if (user.passwordResetToken !== token) throw new ClientError("Invalid email or token");

  if (!isPasswordValid(password))
    throw new ClientError("Password must be at least 8 character long");

  await db
    .update(users)
    .set({
      password: await bcrypt.hash(password, await bcrypt.genSalt()),
      passwordResetToken: null,
    })
    .where(eq(users.id, user.id));

  return new Response();
});
