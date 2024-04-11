import { Option, program } from "@commander-js/extra-typings";
import { faker } from "@faker-js/faker";
import { randomUUID } from "crypto";
import { config } from "dotenv";
import path from "path";
import { DataSource, DataSourceOptions } from "typeorm";
import { SnakeNamingStrategy } from "typeorm-naming-strategies";
import { getAllowedVersions } from "../(utils)";
import { getTags } from "../tags";
import { Email, Module, Notification, Rank, Release, User } from "./entities";

config({ path: path.resolve(process.cwd(), ".env.local") });

function createUser(): User {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  const user = new User();
  user.email = faker.internet.email({ firstName, lastName });
  user.emailVerified = faker.datatype.boolean(0.95);
  user.id = randomUUID();
  user.image = faker.image.avatar();
  user.lastNameChangeTime = null;
  user.modules = [];
  user.name = faker.internet.userName({ firstName, lastName }).replace(".", "_");
  user.notifications = [];
  user.password = faker.internet.password();
  user.passwordResetToken = null;
  user.rank = Rank.DEFAULT;
  user.verificationToken = null;

  return user;
}

function createModule(): Module {
  const module = new Module();
  module.description = faker.lorem.paragraph();
  module.downloads = 0;
  module.hidden = false;
  module.id = randomUUID();
  module.image = faker.image.avatar(); // TODO
  module.name = faker.lorem.word();
  module.releases = [];
  module.summary = faker.lorem.sentence();
  module.tags = [];

  return module;
}

function createRelease(): Release {
  const release = new Release();
  release.changelog = faker.lorem.sentences();
  release.downloads = faker.number.int({ min: 0, max: 1e5 });
  release.game_versions = [];
  release.id = randomUUID();
  release.release_version = faker.system.semver();
  release.verified_at = null;
  release.verified_by = null;

  return release;
}

async function seed(db: DataSource, userCount: number, moduleCount: number, releaseCount: number) {
  const users = faker.helpers.multiple(createUser, { count: userCount });

  faker.helpers.arrayElements(users, 2).forEach(user => {
    user.rank = Rank.TRUSTED;
  });
  faker.helpers.arrayElements(users, 1).forEach(user => {
    user.rank = Rank.ADMIN;
  });

  const modules = faker.helpers.multiple(createModule, { count: moduleCount });

  const releases: Release[] = [];

  const tags = [...(await getTags())];
  const {
    default: { modVersions },
  } = await getAllowedVersions();

  modules.forEach(module => {
    const user = faker.helpers.arrayElement(users);
    module.user = user;
    module.tags = faker.helpers.arrayElements(tags);

    const moduleReleases = faker.helpers.multiple(createRelease, {
      count: releaseCount,
    });

    moduleReleases.forEach(release => {
      release.mod_version = faker.helpers.arrayElement(Object.keys(modVersions));
      release.game_versions = modVersions[release.mod_version as keyof typeof modVersions];
      release.verified = user.rank !== Rank.DEFAULT;
      if (!release.verified) {
        if (faker.datatype.boolean(0.8)) {
          release.verified_at = faker.date.recent();
          release.verified_by = faker.helpers.arrayElement(
            users.filter(user => user.rank == Rank.ADMIN || user.rank == Rank.TRUSTED),
          );
          release.verified = true;
        } else {
          release.downloads = 0;
        }
      } else {
        release.verified_at = faker.date.recent();
        release.verified_by = user;
      }

      release.module = module;
    });

    releases.push(...moduleReleases);

    module.downloads = moduleReleases.reduce((a, b) => a + b.downloads, 0);
  });

  await db.getRepository(User).save(users);
  await db.getRepository(Module).save(modules);
  await db.getRepository(Release).save(releases);
}

async function main() {
  const prog = program
    .name("seed")
    .description("CLI utility to seed the database")
    .version("0.0.1")
    .addOption(new Option("-d, --drop", "drop the database before executing").default(false))
    .addOption(
      new Option("-u, --users <count>", "how many users to create")
        .default(10)
        .argParser(value => parseInt(value)),
    )
    .addOption(
      new Option("-m, --modules <count>", "how many modules to create")
        .default(20)
        .argParser(value => parseInt(value)),
    )
    .addOption(
      new Option("-r, --releases <count>", "how many releases created per module")
        .default(10)
        .argParser(value => parseInt(value)),
    )
    .parse();

  const { users, modules, releases, drop } = prog.opts();

  const connectionOptions: DataSourceOptions = {
    type: "mysql",
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT!),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [Email, Module, Notification, Release, User],
    namingStrategy: new SnakeNamingStrategy(),
  };

  const db = await new DataSource(connectionOptions).initialize();

  if (drop) {
    console.log("Dropping existing data...");
  }
  await db.synchronize(drop);
  if (drop) {
    console.log("Dropped existing data");
  }

  console.log(
    "Seeding database with %d users, %d modules, %d releases per module...",
    users,
    modules,
    releases,
  );

  await seed(db, Math.max(users, 1), Math.max(modules, 1), Math.max(releases, 1));
  console.log("Seeding complete");

  process.exit(0);
}

main();
