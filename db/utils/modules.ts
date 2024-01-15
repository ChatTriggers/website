import type { ModuleWithRelations } from "db";
import { db, modules, releases, users, utils } from "db";
import { saveImageFile } from "db/utils/assets";
import { BadQueryParamError, ClientError, ServerError } from "db/utils/errors";
import type { PublicModule } from "db/utils/pub";
import type { Session } from "db/utils/session";
import { getSessionFromCookies } from "db/utils/session";
import { and, asc, desc, eq, exists, not, or, sql } from "drizzle-orm";
import * as fs from "fs/promises";
import { cookies } from "next/headers";

import { cached } from "./route";

export enum Sort {
  DATE_CREATED_DESC = "DATE_CREATED_DESC",
  DATE_CREATED_ASC = "DATE_CREATED_ASC",
  DOWNLOADS_DESC = "DOWNLOADS_DESC",
  DOWNLOADS_ASC = "DOWNLOADS_ASC",
}

export enum Hidden {
  NONE = "none",
  ONLY = "only",
  ALL = "all",
}

export async function getOne(
  nameOrId: string | number,
  session?: Session,
): Promise<ModuleWithRelations | undefined> {
  if (!session) session = getSessionFromCookies(cookies());

  const result = await db.query.modules.findFirst({
    where: typeof nameOrId === "number" ? eq(modules.id, nameOrId) : eq(modules.name, nameOrId),
    with: {
      user: true,
      releases: true,
    },
  });

  if (!result) return undefined;
  if (!result.hidden) return result;

  if (session?.id === result.userId || session?.rank !== "default") return result;

  return undefined;
}

export async function getManyFromParams(
  params: URLSearchParams,
  session?: Session,
): Promise<ManyResponse> {
  const hidden = params.get("hidden");
  if (hidden && hidden !== Hidden.NONE && hidden !== Hidden.ONLY && hidden !== Hidden.ALL)
    throw new BadQueryParamError("hidden", hidden);

  const sort = params.get("sort");
  if (
    sort &&
    sort !== Sort.DATE_CREATED_ASC &&
    sort !== Sort.DATE_CREATED_DESC &&
    sort !== Sort.DOWNLOADS_ASC &&
    sort != Sort.DOWNLOADS_DESC
  )
    throw new BadQueryParamError("sort", sort);

  return getMany(
    {
      name: params.get("name") ?? undefined,
      summary: params.get("summary") ?? undefined,
      description: params.get("description") ?? undefined,
      owner:
        params
          .get("owner")
          ?.split(",")
          .map(o => parseInt(o) || o) ?? undefined,
      tags: params.get("tags")?.split(",") ?? undefined,
      hidden: hidden as Hidden,
      trusted: getBooleanQuery(params, "trusted"),
      q: params.get("q") ?? undefined,
      hideEmpty: getBooleanQuery(params, "hide_empty"),
      sort: sort as Sort,
      limit: getIntQuery(params, "limit"),
      offset: getIntQuery(params, "offset"),
    },
    session,
  );
}

interface GetManyOptions {
  name?: string;
  summary?: string;
  description?: string;
  owner?: Array<number | string>;
  tags?: string[];
  hidden?: Hidden;
  trusted?: boolean;
  q?: string;
  hideEmpty?: boolean;
  sort?: Sort;
  limit?: number;
  offset?: number;
}

export interface ManyResponse {
  modules: PublicModule[];
  meta: {
    total: number;
    offset: number;
    limit: number;
    sort: Sort;
  };
}

export async function getMany(options: GetManyOptions, session?: Session): Promise<ManyResponse> {
  if (session === null) session = getSessionFromCookies(cookies());

  const qb = db.select().from(modules).leftJoin(users, eq(users.id, modules.userId)).$dynamic();

  if (options.owner) {
    qb.where(
      or(
        ...options.owner.map(owner =>
          typeof owner === "string" ? eq(users.name, owner) : eq(users.id, owner),
        ),
      ),
    );
  }

  if (options.tags)
    qb.where(
      and(...options.tags.map(tag => sql`upper(modules.tags) like %upper(${tag.toUpperCase()})%`)),
    );

  const hidden = options.hidden ?? Hidden.NONE;
  if (hidden === Hidden.NONE) {
    qb.where(eq(modules.hidden, false));
  } else {
    if (!session) throw new ClientError("Must be signed in to include hidden modules");

    if (hidden == Hidden.ONLY) {
      if (session.rank === "default") {
        qb.where(and(eq(modules.hidden, true), eq(users.id, session.id)));
      } else {
        qb.where(eq(modules.hidden, true));
      }
    } else if (session.rank === "default") {
      qb.where(or(eq(modules.hidden, false), eq(users.id, session.id)));
    }
  }

  if (options.trusted) qb.where(not(eq(users.rank, "default")));

  if (options.name) qb.where(sql`upper(modules.name) like %${options.name.toUpperCase()}%`);

  if (options.summary)
    qb.where(sql`upper(modules.summary) like %${options.summary.toUpperCase()}%`);

  if (options.description)
    qb.where(sql`upper(modules.description) like %${options.description.toUpperCase()}%`);

  if (options.q) {
    const q = options.q.toUpperCase();
    qb.where(
      or(
        sql`upper(modules.name) like %${q}%`,
        sql`upper(modules.summary) like %${q}%`,
        sql`upper(modules.description) like %${q}%`,
        sql`upper(user.name) like %${q}%`,
      ),
    );
  }

  if (options.hideEmpty) {
    const sq = db
      .select()
      .from(releases)
      .where(and(eq(releases.moduleId, modules.id), releases.verified));
    qb.where(exists(sq));
  }

  const sort = options.sort ?? Sort.DATE_CREATED_DESC;
  switch (sort) {
    case Sort.DATE_CREATED_ASC:
      qb.orderBy(asc(modules.createdAt));
      break;
    case Sort.DATE_CREATED_DESC:
      qb.orderBy(desc(modules.createdAt));
      break;
    case Sort.DOWNLOADS_ASC:
      qb.orderBy(asc(modules.downloads));
      break;
    case Sort.DOWNLOADS_DESC:
      qb.orderBy(desc(modules.downloads));
      break;
  }

  // TODO: Is there a better way to do this?
  const numRecords = (await qb).length;

  const limit = Math.max(1, Math.min(options.limit ?? 50, 50));
  const offset = Math.max(0, options.offset ?? 0);
  qb.limit(limit).offset(offset);

  const records = await qb;
  return {
    modules: await Promise.all(
      records.map(async r => {
        if (!r.users) throw new ServerError(`Unable to fetch user ${r.modules.userId}`);
        const authed = session && (session.rank !== "default" || session.id === r.modules.userId);
        return {
          ...utils.pub.fromModule(r.modules, authed),
          user: utils.pub.fromUser(r.users, authed),
          releases: (
            await db.query.releases.findMany({
              where: eq(releases.moduleId, r.modules.id),
            })
          ).map(utils.pub.fromRelease),
        };
      }),
    ),
    meta: {
      limit,
      offset,
      sort,
      total: numRecords,
    },
  };
}

export async function saveImage(moduleName: string, file: string | Blob): Promise<string> {
  (await saveImageFile(file)).toFile(`public/assets/modules/${moduleName}.png`);
  return `/assets/modules/${moduleName}.png`;
}

export const getTags = cached(1000 * 60 * 60, async () => {
  return new Set((await fs.readFile("./public/tags.txt")).toString("utf8").split("\n"));
});

export const getTagsFromForm = async (data: FormData): Promise<string[]> => {
  const allowedTags = await getTags();
  const tag = data.get("tags");
  if (typeof tag !== "string") throw new ClientError("Tag must be a string");
  return tag
    .split(",")
    .map(tag => tag.trim())
    .filter(tag => allowedTags.has(tag));
};

function getBooleanQuery(params: URLSearchParams, name: string): boolean | undefined {
  const value = params.get(name);
  if (!value) return undefined;
  if (Array.isArray(value)) throw new BadQueryParamError(name, value);

  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;

  throw new BadQueryParamError(name, value);
}

function getIntQuery(params: URLSearchParams, name: string): number | undefined {
  const value = params.get(name);
  if (!value) return undefined;
  if (Array.isArray(value)) throw new BadQueryParamError(name, value);

  const id = parseInt(value);
  if (isNaN(id)) throw new BadQueryParamError(name, value);
  return id;
}
