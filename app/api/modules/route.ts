import { isModuleValid as isModuleNameValid } from "app/constants";
import { db, modules, users, utils } from "db";
import { ClientError, NotAuthenticatedError, ServerError } from "db/utils/errors";
import { getFormData, getFormEntry, route } from "db/utils/route";
import { getSessionFromRequest } from "db/utils/session";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const GET = route(async (req: NextRequest) => {
  return Response.json(await utils.modules.getManyFromParams(req.nextUrl.searchParams));
});

export const PUT = route(async (req: NextRequest) => {
  const session = getSessionFromRequest(req);
  if (!session) throw new NotAuthenticatedError();

  const user = await db.query.users.findFirst({ where: eq(users.id, session.id) });
  if (!user || !user.emailVerified)
    throw new ServerError("Internal error: Failed to find user for session");

  const form = await getFormData(req);
  const name = await getFormEntry({ form, name: "name", type: "string" });

  const existingModule = await db.query.modules.findFirst({ where: eq(modules.name, name) });
  if (existingModule) throw new ClientError(`A module with name ${name} already exists`);

  if (!isModuleNameValid(name)) {
    throw new ClientError(
      "Module name must be between 3 and 64 characters, and can only contain letters, numbers, and underscores",
    );
  }

  const summary = await getFormEntry({ form, name: "summary", type: "string", optional: true });
  if (summary && summary.length > 300)
    throw new ClientError("Module summary cannot be more than 300 characters");

  const description = await getFormEntry({
    form,
    name: "description",
    type: "string",
    optional: true,
  });

  const image = await getFormEntry({ form, name: "image", type: "file", optional: true });
  const hidden = await getFormEntry({ form, name: "hidden", type: "boolean", optional: true });
  const tags = await utils.modules.getTagsFromForm(form);

  await db.insert(modules).values({
    userId: user.id,
    name,
    summary,
    description,
    image: image ? await utils.modules.saveImage(name, image) : undefined,
    tags: tags.join(","),
    hidden,
  });

  return new Response("Module created", { status: 201 });
});
