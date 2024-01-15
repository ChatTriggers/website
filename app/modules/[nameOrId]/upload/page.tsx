import { utils } from "db";
import type { SlugProps } from "db/utils/route";
import { getAllowedVersions } from "db/utils/route";
import { getSessionFromCookies } from "db/utils/session";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import UploadReleaseComponent from "./UploadReleaseComponent";

export default async function Page({ params }: SlugProps<"nameOrId">) {
  const session = getSessionFromCookies(cookies());
  const { modVersions } = await getAllowedVersions();
  const module_ = await utils.modules.getOne(params.nameOrId, session);
  if (!module_) notFound();

  return (
    <UploadReleaseComponent module={utils.pub.fromModule(module_)} validModVersions={modVersions} />
  );
}
