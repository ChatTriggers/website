import { db, users } from "db";
import { sendVerificationEmail } from "db/utils/email";
import { getFormData, getFormEntry, route } from "db/utils/route";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const POST = route(async (req: NextRequest) => {
  const form = await getFormData(req);
  const email = getFormEntry({ form, name: "email", type: "string" });

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });

  // No error here so a user can't use this endpoint to query email addresses
  if (!user) return new Response();

  await sendVerificationEmail(user);
  return new Response();
});
