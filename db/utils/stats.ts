import { db, modules, releases } from "db";
import { count } from "drizzle-orm";

interface Stats {
  moduleCount: number;
  releaseCount: number;
  totalImports: number;
}

export async function getStats(): Promise<Stats> {
  const moduleCount = (await db.select({ count: count(modules) }).from(modules))[0].count;
  const releaseCount = (await db.select({ count: count(releases) }).from(releases))[0].count;
  const totalImports = (await db.select({ count: count(modules.downloads) }).from(modules))[0]
    .count;

  return { moduleCount, releaseCount, totalImports };
}
