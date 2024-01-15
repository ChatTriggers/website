import { db, modules } from "db";
import { NotFoundError } from "db/utils/errors";
import { getScripts } from "db/utils/releases";
import type { SlugProps } from "db/utils/route";
import { route } from "db/utils/route";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";

export const GET = route(
  async (req: NextRequest, { params }: SlugProps<"nameOrId" | "releaseId">) => {
    const moduleId = parseInt(params.nameOrId);
    const result =
      (await db.query.modules.findFirst({
        where: isNaN(moduleId) ? eq(modules.name, params.nameOrId) : eq(modules.id, moduleId),
      })) ?? notFound();
    const releaseId = parseInt(params.releaseId);
    if (isNaN(releaseId)) notFound();
    const buffer = await getScripts(result, releaseId);
    if (!buffer) throw new NotFoundError("Unknown module or release id");
    return new Response(buffer, { headers: { "Content-Type": "application/zip" } });
  },
);
