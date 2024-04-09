import type { Session } from "app/api";
import { BadQueryParamError, ClientError, getSessionFromCookies } from "app/api";
import Version from "app/api/(utils)/Version";
import type { PublicModule } from "app/api/db";
import { Release } from "app/api/db";
import { getDb, Module, Rank, Sort } from "app/api/db";
import mysql from "mysql2";
import { cookies } from "next/headers";
import { Brackets, FindOptionsUtils } from "typeorm";
import type { URLSearchParams } from "url";
import { isUUID } from "validator";

import { saveImageFile } from "../(utils)/assets";

export enum Hidden {
  NONE = "none",
  ONLY = "only",
  ALL = "all",
}

export const getOnePublic = async (
  nameOrId: string,
  session?: Session,
): Promise<PublicModule | undefined> => {
  return (await getOne(nameOrId, session))?.public(session);
};

export const getOne = async (nameOrId: string, session?: Session): Promise<Module | undefined> => {
  const db = await getDb();
  const builder = db
    .getRepository(Module)
    .createQueryBuilder("module")
    .leftJoinAndSelect("module.user", "user");

  FindOptionsUtils.joinEagerRelations(
    builder,
    builder.alias,
    builder.expressionMap.mainAlias!.metadata,
  );

  if (isUUID(nameOrId)) {
    builder.where("module.id = :id", { id: nameOrId });
  } else {
    builder.where("upper(module.name) = :name", { name: nameOrId.toUpperCase() });
  }

  const result = await builder.getOne();
  if (!result) return undefined;
  if (!result.hidden) return result;

  if (session === null) session = getSessionFromCookies(cookies());
  if (session?.id === result.user.id || session?.rank !== Rank.DEFAULT) return result;

  return undefined;
};

export interface ManyResponse {
  modules: Module[];
  meta: {
    total: number;
    offset: number;
    limit: number;
    sort: Sort;
  };
}

export interface ManyResponsePublic {
  modules: PublicModule[];
  meta: ManyResponse["meta"];
}

export const getManyPublic = async (params: URLSearchParams): Promise<ManyResponsePublic> => {
  const { modules, meta } = await getMany(params);

  return {
    modules: await Promise.all(modules.map(m => m.public())),
    meta,
  };
};

export const getMany = async (
  params: URLSearchParams,
  session: Session | null = null,
): Promise<ManyResponse> => {
  if (session === null) session = getSessionFromCookies(cookies()) ?? null;

  const name = params.get("name");
  const summary = params.get("summary");
  const description = params.get("description");
  const owner = params.get("owner");
  const tags = params.get("tag");
  let q = params.get("q");
  let limit = getIntQuery(params, "limit") ?? 25;
  let offset = getIntQuery(params, "offset") ?? 0;
  let sort = params.get("sort") ?? "DATE_CREATED_DESC";
  const hidden = params.get("hidden") ?? Hidden.NONE;
  const trusted = getBooleanQuery(params, "trusted") ?? false;
  const hideEmpty = getBooleanQuery(params, "hide_empty") ?? true;

  if (limit < 1) limit = 1;
  if (limit > 100) limit = 100;
  if (offset < 0) offset = 0;

  if (
    Array.isArray(sort) ||
    (sort !== "DATE_CREATED_DESC" &&
      sort !== "DATE_CREATED_ASC" &&
      sort !== "DOWNLOADS_DESC" &&
      sort !== "DOWNLOADS_ASC")
  )
    throw new BadQueryParamError("sort", sort);

  const db = await getDb();
  const builder = db
    .getRepository(Module)
    .createQueryBuilder("module")
    .leftJoinAndSelect("module.user", "user");

  FindOptionsUtils.joinEagerRelations(
    builder,
    builder.alias,
    builder.expressionMap.mainAlias!.metadata,
  );

  if (owner) {
    const values = Array.isArray(owner) ? owner : owner.split(",");
    builder.andWhere(
      new Brackets(qb => {
        for (const value of values) {
          if (isUUID(value)) {
            qb.orWhere("user.id = :userId", { userId: value });
          } else {
            qb.orWhere("upper(user.name) like " + mysql.escape(`%${value.toUpperCase()}%`));
          }
        }
      }),
    );
  }

  if (tags) {
    for (const value of tags.split(","))
      builder.andWhere("upper(module.tags) like " + mysql.escape(`%${value.toUpperCase()}%`));
  }

  if (hidden !== Hidden.NONE && hidden !== Hidden.ALL && hidden !== Hidden.ONLY) {
    throw new BadQueryParamError("hidden", hidden);
  }

  if (hidden === Hidden.NONE) {
    builder.andWhere("module.hidden = 0");
  } else {
    if (!session) throw new ClientError("Must be signed in to include hidden modules");

    if (hidden === Hidden.ONLY) {
      if (session.rank === Rank.DEFAULT) {
        builder.andWhere("(module.hidden = 1 and user.id = :userId)", { userId: session.id });
      } else {
        builder.andWhere("module.hidden = 1");
      }
    } else if (session.rank === Rank.DEFAULT) {
      builder.andWhere("(module.hidden = 0 or user.id = :userId)", { userId: session.id });
    }
  }

  if (trusted) {
    builder.andWhere("user.rank != 'default'");
  }

  if (name) {
    builder.andWhere("upper(module.name) like " + mysql.escape(`%${name.toUpperCase()}%`));
  }

  if (summary) {
    builder.andWhere("upper(module.summary) like " + mysql.escape(`%${summary.toUpperCase()}%`));
  }

  if (description) {
    builder.andWhere(
      "upper(module.description) like " + mysql.escape(`%${description.toUpperCase()}%`),
    );
  }

  if (q) {
    if (Array.isArray(q)) throw new BadQueryParamError("q", q);

    q = mysql.escape(`%${q.toUpperCase()}%`);
    builder.andWhere(
      new Brackets(qb => {
        qb.where("upper(module.description) like " + q)
          .orWhere("upper(module.name) like " + q)
          .orWhere("upper(user.name) like " + q);
      }),
    );
  }

  if (hideEmpty) {
    const innerBuilder = db
      .getRepository(Release)
      .createQueryBuilder("release")
      .where("release.module_id = module.id")
      .andWhere("release.verified");

    builder.andWhereExists(innerBuilder).groupBy("module.id");
  }

  switch (sort) {
    case "DOWNLOADS_ASC":
      builder.orderBy("module.downloads", "ASC");
      break;
    case "DOWNLOADS_DESC":
      builder.orderBy("module.downloads", "DESC");
      break;
    case "DATE_CREATED_ASC":
      builder.orderBy("module.created_at", "ASC");
      break;
    default:
      sort = Sort.DATE_CREATED_DESC;
      builder.orderBy("module.created_at", "DESC");
      break;
  }

  builder.skip(offset).take(limit);

  const [modules, total] = await builder.getManyAndCount();
  return {
    modules: modules.filter(module => {
      if (!module.hidden) return true;
      if (!session) return false;
      return session.id === module.user.id || session.rank !== Rank.DEFAULT;
    }),
    meta: { total, offset, limit, sort: sort as Sort },
  };
};

const getIntQuery = (params: URLSearchParams, name: string): number | undefined => {
  const value = params.get(name);
  if (!value) return undefined;
  if (Array.isArray(value)) throw new BadQueryParamError(name, value);

  const id = parseInt(value);
  if (isNaN(id)) throw new BadQueryParamError(name, value);
  return id;
};

export const getBooleanQuery = (params: URLSearchParams, name: string): boolean | undefined => {
  const value = params.get(name);
  if (!value) return undefined;
  if (Array.isArray(value)) throw new BadQueryParamError(name, value);

  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;

  // TODO: Add an "expected" parameter here
  throw new BadQueryParamError(name, value);
};

export const getTagsFromForm = (data: FormData): string[] => {
  return data
    .getAll("tags")
    .flatMap(tag => {
      if (typeof tag !== "string") throw new ClientError("Tag must be a string");
      return tag.split(",");
    })
    .map(tag => tag.trim())
    .filter(tag => tag.length);
};

export const saveImage = async (module: Module, file: string | Blob) => {
  (await saveImageFile(file)).toFile(`public/assets/modules/${module.name}.png`);
  module.image = `/assets/modules/${module.name}.png`;
};

export const findMatchingRelease = async (
  module: Module,
  modVersion: Version,
  gameVersions: Version[],
): Promise<Release | undefined> => {
  const releases = module.releases.map(release => ({
    release,
    releaseVersion: Version.parse(release.release_version)!,
    modVersion: Version.parse(release.mod_version)!,
    gameVersions: release.game_versions.map(Version.parse) as Version[],
  }));

  releases.sort((r1, r2) => {
    const releaseComparison = r1.releaseVersion.compare(r2.releaseVersion);
    if (releaseComparison !== 0) return releaseComparison;
    return r1.modVersion.compare(r2.modVersion);
  });

  for (const release of releases) {
    if (release.modVersion.major > modVersion.major) continue;

    if (
      gameVersions.some(gameVersion =>
        release.gameVersions.some(
          releaseGameVersion => releaseGameVersion.compare(gameVersion) === 0,
        ),
      )
    ) {
      return release.release;
    }
  }
};
