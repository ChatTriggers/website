// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

// Migrates all data from the old database to the new database. To run,
// insert the following at the end of utils/db/index.ts:
//
// import { migrate } from "./migrate";
// await migrate();
// process.exit(0);
//
// Also need to add "synchronize: true" to the DataSource creation options.

import { saveImage } from "app/api/modules";
import mysql from "mysql2/promise";
import { stringify, v4 as uuid } from "uuid";

import { db, Module, Release, User } from "./index";

export const migrate = async () => {
  const oldDb = await mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT!),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: "new_website",
  });

  const [oldModules] = await oldDb.execute("select * from Modules;");
  const [oldReleases] = await oldDb.execute("select * from Releases;");
  const [oldUsers] = await oldDb.execute("select * from Users;");

  const moduleIdMap = new Map<number, string>();
  const userIdMap = new Map<number, string>();

  console.log("Mapping users...");
  const users: User[] = oldUsers
    .map(oldUser => {
      const user = new User();
      const newId = uuid();
      userIdMap.set(oldUser.id, newId);
      user.id = newId;
      user.name = oldUser.name;
      user.email = oldUser.email;
      user.password = oldUser.password;
      user.image = null;
      user.rank = oldUser.rank;
      user.created_at = oldUser.created_at;
      user.updated_at = oldUser.updated_at;
      return user;
    })
    .filter(user => user.name.length <= 32);

  console.log("Mapping modules...");

  // Map them this way so the fetch requests are _not_ in parallel, otherwise it fails
  const modules: Module[] = [];
  for (const oldModule of oldModules) {
    const module_ = new Module();
    const newId = uuid();
    moduleIdMap.set(oldModule.id, newId);
    module_.id = newId;
    module_.name = oldModule.name;
    module_.description = oldModule.description;
    module_.downloads = oldModule.downloads;

    const userId = userIdMap.get(oldModule.user_id);
    if (!userId) throw new Error(`Unknown user id ${oldModule.user_id}`);
    module_.user = users.find(u => u.id === userId);
    if (!module_.user) throw new Error(`Could not find user id ${oldModule.user_id}`);

    module_.hidden = oldModule.hidden;
    module_.created_at = oldModule.created_at;
    module_.updated_at = oldModule.updated_at;
    module_.tags = oldModule.tags.length
      ? (oldModule.tags as string)
          .split(",")
          .map(tag => tag.trim())
          .filter(tag => tag.length)
      : [];

    if (oldModule.image) {
      console.log(`Fetching image ${oldModule.image}...`);
      const response = await fetch(oldModule.image, { cache: "no-store" });
      await saveImage(module_, await response.blob());
    } else {
      module_.image = null;
    }

    modules.push(module_);
  }

  console.log("Mapping releases...");
  const releases: Release[] = oldReleases.map(oldRelease => {
    const release = new Release();
    release.id = stringify(oldRelease.id);

    const moduleId = moduleIdMap.get(oldRelease.module_id);
    if (!moduleId) throw new Error(`Unknown module id ${oldRelease.module_id}`);
    release.module = modules.find(m => m.id === moduleId);
    if (!release.module) throw new Error(`Could not find module ${oldRelease.module_id}`);

    release.release_version = oldRelease.release_version;
    release.mod_version = oldRelease.mod_version;
    release.game_versions = oldRelease.mod_version.startsWith("3")
      ? ["1.19.4", "1.20.1"]
      : ["1.8.9"];
    release.changelog = oldRelease.changelog;
    release.downloads = oldRelease.downloads;
    release.created_at = oldRelease.created_at;
    release.updated_at = oldRelease.updated_at;
    release.verified = oldRelease.verified;
    return release;
  });

  console.log("Writing users...");
  await db.getRepository(User).save(users);

  console.log("Writing modules...");
  await db.getRepository(Module).save(modules);

  console.log("Writing releases...");
  await db.getRepository(Release).save(releases);

  // I made this in sql before I realized I could do it in code, so I might as well use it
  // Some modules have more than 2 duplicates so we have to run it twice
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await db.query(`
      delete from \`release\` 
      where id in (
        select \`release\`.id 
        from \`release\` 
        left join module on module.id = \`release\`.module_id 
        group by release_version, module_id 
        having count(release_version) > 1 and count(module_id) > 1 
        order by \`release\`.created_at desc
      );
    `);

    if (result.affectedRows === 0) break;
  }
};
