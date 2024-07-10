import type { SearchParamProps, SlugProps } from "app/(utils)/next";
import { User, db, setSession } from "app/api";
import { notFound } from "next/navigation";

import { cookies } from "next/headers";
import VerifyComponent from "./VerifyComponent";

export default async function Page({ searchParams, params }: SearchParamProps & SlugProps<"user">) {
  const { user } = params;
  const { token } = searchParams;

  if (!token || typeof token !== "string") notFound();
  const dbUser = await db.user.findFirst({ where: { verificationToken: token } });
  if (!dbUser || dbUser.name !== user) notFound();

  const newUser = await db.user.update({
    where: {
      id: dbUser.id,
    },
    data: {
      emailVerified: true,
      verificationToken: null,
    },
  });
  setSession(cookies(), await newUser.publicAuthenticated());

  return <VerifyComponent />;
}
