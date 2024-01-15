import { db, users } from "db";
import type { SearchParamProps } from "db/utils/route";
import { eq } from "drizzle-orm";

import InitiateResetComponent from "./InitiateResetComponent";
import InvalidTokenComponent from "./InvalidTokenComponent";
import ResetPasswordComponent from "./ResetPasswordComponent";

export default async function Page({ searchParams }: SearchParamProps) {
  const token = searchParams.token;
  if (typeof token === "string") {
    const user = await db.query.users.findFirst({ where: eq(users.passwordResetToken, token) });
    if (!user) return <InvalidTokenComponent />;
    if (user.passwordResetToken !== token) return <InvalidTokenComponent />;
    return <ResetPasswordComponent email={user.email} token={token} />;
  }

  return <InitiateResetComponent />;
}
