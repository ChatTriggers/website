import type { PublicUser } from "app/api/db";
import { getDb, Module, User } from "app/api/db";
import { isUUID } from "validator";

export const getUserPublic = async (nameOrId: string): Promise<PublicUser | undefined> => {
  return (await getUser(nameOrId))?.public();
};

export const getUser = async (nameOrId: string): Promise<User | undefined> => {
  const db = await getDb();
  const builder = db.getRepository(User).createQueryBuilder("user");

  if (isUUID(nameOrId)) {
    builder.where("id = :id", { id: nameOrId });
  } else {
    builder.where("name = :name", { name: nameOrId });
  }

  return (await builder.getOne()) ?? undefined;
};

export const getDownloads = async (user: User): Promise<number> => {
  const db = await getDb();
  const result = await db
    .getRepository(Module)
    .createQueryBuilder("module")
    .leftJoinAndSelect("module.user", "user")
    .where("user.id = :id", { id: user.id })
    .select("sum(module.downloads)", "downloads")
    .execute();
  return parseInt(result[0].downloads);
};
