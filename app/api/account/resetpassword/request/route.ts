import { isEmailValid } from "app/constants";
import type { User } from "db";
import { db, users } from "db";
import { EmailParams, sendEmail } from "db/utils/email";
import { BadQueryParamError } from "db/utils/errors";
import { getFormData, getFormEntry, route } from "db/utils/route";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";

export const POST = route(async (req: NextRequest) => {
  const form = await getFormData(req);
  const email = getFormEntry({ form, name: "email", type: "string" });

  if (!isEmailValid(email)) throw new BadQueryParamError("email", email);

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    // Do not return an error since that would provide information to the user
    return new Response();
  }

  await sendPasswordResetEmail(user);
  return new Response();
});

const sendPasswordResetEmail = async (user: User) => {
  const token = uuid();
  await db.update(users).set({ passwordResetToken: token }).where(eq(users.id, user.id));

  const params = new EmailParams()
    .setTemplateId(process.env.MAILERSEND_PASSWORD_RESET_TEMPLATE_ID!)
    .setVariables([
      {
        email: user.email,
        substitutions: [
          {
            var: "name",
            value: user.name,
          },
          {
            var: "reset_link",
            value: `${process.env.NEXT_PUBLIC_WEB_ROOT}/auth/resetpassword?token=${user.passwordResetToken}`,
          },
        ],
      },
    ]);

  await sendEmail(user.email, params);
};
