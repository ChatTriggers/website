import type { Module, Rank, Release, User } from "db";

export interface PublicModule {
  id: number;
  name: string;
  summary?: string;
  description?: string;
  image?: string;
  downloads: number;
  tags?: string[];
  hidden: boolean;
  createdAt: number;

  // Relations
  user?: PublicUser;
  releases?: PublicRelease[];
}

export interface AuthenticatedModule extends PublicModule {
  user?: AuthenticatedUser;
}

export interface PublicUser {
  id: number;
  name: string;
  image?: string;
  createdAt: number;
}

export interface AuthenticatedUser extends PublicUser {
  email: string;
  emailVerified: boolean;
  lastNameChangeTime?: number;
  verificationToken?: string;
  passwordResetToken?: string;
  rank: Rank;
}

export interface PublicRelease {
  id: number;
  releaseVersion: string;
  modVersion: string;
  gameVersions: string[];
  changelog?: string;
  downloads: number;
  verified: boolean;
  createdAt: number;
}

export function fromModule(
  module: Module,
  authenticated: boolean = false,
): PublicModule | AuthenticatedModule {
  return {
    id: module.id,
    name: module.name,
    summary: module.summary ?? undefined,
    description: module.description ?? undefined,
    image: module.image ?? undefined,
    downloads: module.downloads,
    tags: module.tags?.split(","),
    hidden: module.hidden,
    createdAt: module.createdAt.getTime(),
    user: module.user ? fromUser(module.user, authenticated) : undefined,
    releases: module.releases?.map(fromRelease),
  };
}

export function fromUser(
  user: User,
  authenticated: boolean = false,
): PublicUser | AuthenticatedUser {
  const baseUser: PublicUser = {
    id: user.id,
    name: user.name,
    image: user.image ?? undefined,
    createdAt: user.createdAt.getTime(),
  };

  if (authenticated) {
    return {
      ...baseUser,
      email: user.email,
      emailVerified: user.emailVerified,
      lastNameChangeTime: user.lastNameChangeTime?.getTime(),
      verificationToken: user.verificationToken ?? undefined,
      passwordResetToken: user.passwordResetToken ?? undefined,
      rank: user.rank,
    } satisfies AuthenticatedUser;
  }

  return baseUser;
}

export function fromRelease(release: Release): PublicRelease {
  return {
    id: release.id,
    releaseVersion: release.releaseVersion,
    modVersion: release.modVersion,
    gameVersions: release.gameVersions.split(","),
    changelog: release.changelog ?? undefined,
    downloads: release.downloads,
    verified: release.verified,
    createdAt: release.createdAt.getTime(),
  };
}
