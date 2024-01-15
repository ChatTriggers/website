import bcrypt from "bcrypt";
import type { User } from "db";
import { db, users } from "db";
import { saveImageFile } from "db/utils/assets";
import { eq, or } from "drizzle-orm";

export const verify = async (username: string, password: string): Promise<User | undefined> => {
  const user = await db.query.users.findFirst({
    where: or(eq(users.name, username), eq(users.email, username)),
  });

  if (user && bcrypt.compareSync(password, user.password)) return user;
};

export const saveImage = async (userName: string, file: string | Blob): Promise<string> => {
  (await saveImageFile(file)).toFile(`public/assets/users/${userName}.png`);
  return `/assets/users/${userName}.png`;
};
