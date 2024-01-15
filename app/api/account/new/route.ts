import * as account from "app/api/account";
import { isEmailValid, isPasswordValid, isUsernameValid } from "app/constants";
import bcrypt from "bcrypt";
import { db, users, utils } from "db";
import { sendVerificationEmail } from "db/utils/email";
import { BadQueryParamError, ClientError, ConflictError } from "db/utils/errors";
import type { AuthenticatedUser } from "db/utils/pub";
import { getFormData, getFormEntry, route } from "db/utils/route";
import { getSessionFromRequest, setSession } from "db/utils/session";
import { eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export const PUT = route(async (req: NextRequest) => {
  const existingSession = getSessionFromRequest(req);
  if (existingSession) throw new ConflictError("Already authenticated");

  const form = await getFormData(req);
  const name = getFormEntry({ form, name: "username", type: "string" });
  const email = getFormEntry({ form, name: "email", type: "string" });
  const image = getFormEntry({ form, name: "image", type: "file", optional: true });
  const password = getFormEntry({ form, name: "password", type: "string" });

  if (!isUsernameValid(name)) throw new BadQueryParamError("username", name);
  if (!isEmailValid(email)) throw new BadQueryParamError("email", email);
  if (!isPasswordValid(password))
    throw new ClientError("Password must be at least 8 characters long");

  const userByName = await db.query.users.findFirst({
    where: sql`lower(user.name) like lower(${name})`,
  });
  if (userByName) throw new ConflictError("Username already taken");

  const userByEmail = await db.query.users.findFirst({
    where: sql`lower(user.email) like lower(${email})`,
  });
  if (userByEmail) throw new ConflictError("Email already taken");

  const newUser = {
    name,
    email,
    password: bcrypt.hashSync(password, bcrypt.genSaltSync()),
    image: image && (await account.saveImage(name, image)),
  };

  await db.insert(users).values(newUser);
  const user = (await db.query.users.findFirst({ where: eq(users.name, name) }))!;

  // Log the user in and send the verification email
  const authedUser = utils.pub.fromUser(user, true) as AuthenticatedUser;
  const response = NextResponse.json(authedUser, { status: 201 });
  setSession(response, authedUser);
  await sendVerificationEmail(user);

  return response;
});
