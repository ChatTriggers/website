import { utils } from "db";
import type { AuthenticatedUser } from "db/utils/pub";
import type { SlugProps } from "db/utils/route";
import { getSessionFromCookies } from "db/utils/session";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import ModuleComponent from "./ModuleComponent";

export default async function Page({ params }: SlugProps<"nameOrId">) {
  const user = getSessionFromCookies(cookies());

  const [authedUser, module_] = await Promise.all([
    user ? utils.users.getUser(user?.id) : undefined,
    utils.modules.getOne(params.nameOrId),
  ]);

  if (!module_) notFound();

  return (
    <ModuleComponent
      module={utils.pub.fromModule(module_, !!user)}
      user={authedUser && (utils.pub.fromUser(authedUser, true) as AuthenticatedUser)}
    />
  );
}
