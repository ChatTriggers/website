import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

const id = int("id", { unsigned: true }).notNull().autoincrement().primaryKey();
const idref = (name: string) => int(name, { unsigned: true }).notNull();

export const Modules = mysqlTable("Modules", {
  id,
  userId: idref("user_id"),
  name: varchar("name", { length: 64 }).notNull().unique(),
  description: text("description").notNull(),
  image: varchar("image", { length: 50 }),
  downloads: int("downloads", { unsigned: true }).notNull().default(0),
  hidden: boolean("hidden").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  tags: varchar("tags", { length: 2000 }),
});

export const ModulesRelations = relations(Modules, ({ one, many }) => ({
  user: one(Users, { fields: [Modules.userId], references: [Users.id] }),
  releases: many(Releases),
}));

export const Releases = mysqlTable("Releases", {
  id,
  moduleId: idref("module_id"),
  releaseVersion: varchar("release_version", { length: 20 }).notNull(),
  modVersion: varchar("mod_version", { length: 20 }).notNull(),
  changelog: text("changelog").notNull(),
  downloads: int("downloads").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
  verified: boolean("verified").notNull().default(false),
  verificationToken: varchar("verification_token", { length: 36 }),
  verificationMessage: bigint("verification_message", { mode: "bigint" }),
});

export const ReleasesRelations = relations(Releases, ({ one }) => ({
  module: one(Modules, { fields: [Releases.moduleId], references: [Modules.id] }),
}));

export const Users = mysqlTable("Users", {
  id,
  name: varchar("name", { length: 191 }).notNull().unique(),
  email: varchar("email", { length: 191 }).notNull().unique(),
  password: varchar("password", { length: 191 }).notNull(),
  rank: mysqlEnum("rank", ["default", "trusted", "admin"]).notNull().default("default"),
  rememberToken: varchar("remember_token", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});
