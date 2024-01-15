import { getSessionFromCookies } from "db/utils/session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import SignOutComponent from "./SignOutComponent";

export default function Page() {
  const user = getSessionFromCookies(cookies());
  return user ? <SignOutComponent /> : redirect("/");
}
