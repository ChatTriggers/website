import type { SlugProps } from "app/(utils)/next";
import { ClientError, db, route, setSession } from "app/api";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

export const GET = route(async (req: NextRequest, { params }: SlugProps<"nameOrId">) => {
  const user = params.nameOrId;
  const token = new URL(req.url).searchParams.get("token");

  if (!token || typeof token !== "string") throw new ClientError("Missing verification token");
  const dbUser = await db.user.findFirst({ where: { verificationToken: token } });
  if (!dbUser || dbUser.name !== user) throw new ClientError("Invalid verification token");

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
  redirect(`/users/${dbUser.name}/verify`);
});
