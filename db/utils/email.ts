import type { User } from "db";
import { db, emails, users } from "db";
import { and, eq, inArray } from "drizzle-orm";
import { EmailParams } from "mailersend";
import { MailerSend, Recipient, Sender } from "mailersend";
import { v4 as uuid } from "uuid";

const mailerSend = new MailerSend({
  apiKey: process.env.MAILERSEND_API_KEY!,
});

const sentFrom = new Sender("no-reply@chattriggers.com", "ChatTriggers");

export const sendEmail = async (recipient: string, params: EmailParams) => {
  const existingBounceOrComplaint = await db.query.emails.findFirst({
    where: and(eq(emails.recipient, recipient), inArray(emails.type, ["bounce", "complaint"])),
  });

  if (existingBounceOrComplaint) return;

  params.setFrom(sentFrom).setTo([new Recipient(recipient)]);
  await mailerSend.email.send(params);
};

export const sendVerificationEmail = async (user: User) => {
  user.verificationToken = uuid();
  await db
    .update(users)
    .set({ verificationToken: user.verificationToken })
    .where(eq(users.id, user.id));

  const params = new EmailParams()
    .setTemplateId(process.env.MAILERSEND_VERIFICATION_TEMPLATE_ID!)
    .setVariables([
      {
        email: user.email,
        substitutions: [
          {
            var: "name",
            value: user.name,
          },
          {
            var: "verification_link",
            value: `${process.env.NEXT_PUBLIC_WEB_ROOT}/users/${user.name}/verify?token=${user.verificationToken}`,
          },
        ],
      },
    ]);

  await sendEmail(user.email, params);
};

export { EmailParams, Recipient };
