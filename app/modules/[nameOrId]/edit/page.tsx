import { utils } from "db";
import type { SlugProps } from "db/utils/route";
import { getSessionFromCookies } from "db/utils/session";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import EditModuleComponent from "./EditModuleComponent";

export default async function Page({ params }: SlugProps<"nameOrId">) {
  const user = getSessionFromCookies(cookies());
  const targetModule = (await utils.modules.getOne(params.nameOrId)) ?? notFound();

  if (!user || user.id !== targetModule.user.id) notFound();

  const tags = await utils.modules.getTags();

  return (
    <EditModuleComponent
      targetModule={utils.pub.fromModule(targetModule)}
      availableTags={[...tags]}
    />
  );
}
