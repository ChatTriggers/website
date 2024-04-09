import { Email, getDb, User } from "app/api/db";
import { randomUUID } from "crypto";
import { EmailParams, MailerSend, Recipient, Sender } from "mailersend";
import { In } from "typeorm";

const mailerSend = new MailerSend({
  apiKey: process.env.MAILERSEND_API_KEY!,
});

const sentFrom = new Sender("no-reply@chattriggers.com", "ChatTriggers");

export const sendEmail = async (recipient: string, params: EmailParams) => {
  const db = await getDb();
  const existingBounceOrComplaint = await db.getRepository(Email).findOneBy({
    recipient,
    type: In(["bounce", "complaint"]),
  });

  if (existingBounceOrComplaint) return;

  params.setFrom(sentFrom).setTo([new Recipient(recipient)]);
  await mailerSend.email.send(params);
};

export const sendVerificationEmail = async (user: User) => {
  user.verificationToken = randomUUID();
  const db = await getDb();
  db.getRepository(User).save(user);

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
