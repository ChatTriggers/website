import { db, modules, utils } from "db";
import {
  BadQueryParamError,
  ClientError,
  ForbiddenError,
  NotAuthenticatedError,
  NotFoundError,
} from "db/utils/errors";
import type { SlugProps } from "db/utils/route";
import { getFormData, getFormEntry, route } from "db/utils/route";
import { getSessionFromRequest } from "db/utils/session";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const GET = route(async (req: NextRequest, { params }: SlugProps<"nameOrId">) => {
  const session = getSessionFromRequest(req);
  const module_ = await utils.modules.getOne(params.nameOrId, session);
  if (module_) return Response.json(utils.pub.fromModule(module_, module_.userId === session?.id));
  throw new NotFoundError("Module not found");
});

export const PATCH = route(async (req: NextRequest, { params }: SlugProps<"nameOrId">) => {
  const module_ = await utils.modules.getOne(params.nameOrId);
  if (!module_) throw new NotFoundError("Module not found");

  const sessionUser = getSessionFromRequest(req);
  if (!sessionUser) throw new NotAuthenticatedError();

  if (module_.user.id !== sessionUser.id && sessionUser.rank === "default")
    throw new ForbiddenError("No permission to edit module");

  const form = await getFormData(req);
  const summary = getFormEntry({ form, name: "summary", type: "string", optional: true });
  if (summary && summary.length > 300)
    throw new ClientError("Module summary cannot be more than 300 characters");

  module_.summary = summary ?? null;

  module_.description =
    getFormEntry({ form, name: "description", type: "string", optional: true }) ?? null;

  const image = getFormEntry({ form, name: "image", type: "file", optional: true });
  if (image) {
    await utils.modules.saveImage(module_.name, image);
  } else {
    module_.image = null;
  }

  const hidden = getFormEntry({ form, name: "hidden", type: "string", optional: true });
  if (hidden && hidden !== "0" && hidden !== "1" && hidden !== "true" && hidden !== "false")
    throw new ClientError("Module hidden must be a boolean string");
  module_.hidden = hidden === "1" || hidden === "true";

  const tags = form.get("tags");
  if (tags && typeof tags !== "string") throw new BadQueryParamError("tags", "<file>");
  module_.tags = tags;

  await db.update(modules).set(module_).where(eq(modules.id, module_.id));

  return new Response("Module updated");
});

export const DELETE = route(async (req: NextRequest, { params }: SlugProps<"nameOrId">) => {
  const module_ = await utils.modules.getOne(params.nameOrId);
  if (!module_) throw new NotFoundError("Module not found");

  const sessionUser = getSessionFromRequest(req);
  if (!sessionUser) throw new NotAuthenticatedError();

  if (module_.user.id !== sessionUser.id && sessionUser.rank === "default")
    throw new ForbiddenError("No permission to edit module");

  await db.delete(modules).where(eq(modules.id, module_.id));

  return new Response("Module deleted");
});
