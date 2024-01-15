import { relations } from "drizzle-orm";
import {
  boolean,
  datetime,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

const id = int("id", { unsigned: true }).notNull().autoincrement().primaryKey();
const idref = (name: string) => int(name, { unsigned: true }).notNull();

export const modules = mysqlTable("modules", {
  id,
  userId: idref("user_id"),
  name: varchar("name", { length: 64 }).notNull().unique(),
  summary: varchar("summary", { length: 300 }),
  description: text("description"),
  image: varchar("image", { length: 255 }),
  downloads: int("downloads").notNull().default(0),
  hidden: boolean("hidden").notNull().default(false),
  tags: varchar("tags", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const modulesRelations = relations(modules, ({ one, many }) => ({
  user: one(users, { fields: [modules.userId], references: [users.id] }),
  releases: many(releases),
}));

export type Module = typeof modules.$inferSelect & {
  user?: User;
  releases?: Release[];
};

export type ModuleWithRelations = typeof modules.$inferSelect & {
  user: User;
  releases: Release[];
};

export const releases = mysqlTable("releases", {
  id,
  moduleId: idref("module_id"),
  releaseVersion: varchar("release_version", { length: 32 }).notNull(),
  modVersion: varchar("mod_version", { length: 16 }).notNull(),
  gameVersions: varchar("game_versions", { length: 255 }).notNull(),
  changelog: text("changelog"),
  downloads: int("downloads").notNull().default(0),
  verified: boolean("verified").notNull().default(false),
  verificationMessageId: varchar("verification_message_id", { length: 64 }),
  verifiedBy: int("user_id", { unsigned: true }),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const releasesRelations = relations(releases, ({ one }) => ({
  module: one(modules, { fields: [releases.moduleId], references: [modules.id] }),
  verifier: one(users, { fields: [releases.verifiedBy], references: [users.id] }),
}));

export type Release = typeof releases.$inferSelect & {
  module?: Module;
  verifier?: User;
};

export const users = mysqlTable("users", {
  id,
  name: varchar("name", { length: 32 }).unique().notNull(),
  email: varchar("email", { length: 192 }).unique().notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  lastNameChangeTime: datetime("last_name_change_time"),
  verificationToken: varchar("verification_token", { length: 255 }),
  passwordResetToken: varchar("password_reset_token", { length: 255 }),
  image: varchar("image", { length: 255 }),
  password: varchar("password", { length: 192 }).notNull(),
  rank: mysqlEnum("rank", ["default", "trusted", "admin"]).notNull().default("default"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  modules: many(modules),
}));

export type User = typeof users.$inferSelect & {
  modules?: Module[];
};

export type Rank = (typeof users.rank.enumValues)[number];

export const emails = mysqlTable("emails", {
  id,
  type: mysqlEnum("type", ["delivery", "bounce", "complaint"]).notNull(),
  subtype: varchar("subtype", { length: 50 }),
  recipient: varchar("recipient", { length: 255 }),
  timestamp: varchar("timestamp", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Email = typeof emails.$inferSelect;

export const notifications = mysqlTable("notifications", {
  id,
  userId: idref("user_id"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export type Notification = typeof notifications.$inferSelect;
