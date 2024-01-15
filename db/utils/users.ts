import type { User } from "db";
import { db, modules, users } from "db";
import { eq, sum } from "drizzle-orm";

export const getUser = async (nameOrId: string | number): Promise<User | undefined> => {
  return await db.query.users.findFirst({
    where: typeof nameOrId === "number" ? eq(users.id, nameOrId) : eq(users.name, nameOrId),
  });
};

export const getDownloads = async (user: User): Promise<number> => {
  const result = await db
    .select({ downloads: sum(modules.downloads) })
    .from(modules)
    .where(eq(modules.userId, user.id));
  return parseInt(result[0].downloads!);
};
