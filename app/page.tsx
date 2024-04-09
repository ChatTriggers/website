import { Book, ChevronRight, Code, Download } from "@mui/icons-material";
import { Box, Button, Divider, Grid, Sheet, Stack, Typography } from "@mui/joy";
import { Octokit } from "@octokit/rest";
import { cookies } from "next/headers";
import Link from "next/link";
import { Fragment } from "react";
import { In } from "typeorm";

import { cached, getSessionFromCookies } from "./api";
import type { AuthenticatedUser } from "./api/db";
import { getDb, Module, Release, User } from "./api/db";
import { getStats } from "./api/statistics";
import AppBarIcons from "./appbar/AppBarIcons";
import CTLogo from "./appbar/CTLogo";
import SearchBar from "./appbar/SearchBar";
import type { GitInfo } from "./Home";
import { DownloadComponent } from "./Home";

interface Props {
  user?: AuthenticatedUser;
}

function FakeAppBar({ user }: Props) {
  return (
    <Stack
      direction="row"
      mt={1}
      px={2}
      maxWidth={1000}
      width="100%"
      display="flex"
      alignContent="center"
      alignItems="center"
      justifyContent="space-between"
      justifyItems="center"
      flexWrap="wrap"
    >
      <CTLogo />
      <Box display="flex">
        <AppBarIcons user={user} />
      </Box>
    </Stack>
  );
}

function Header({ user }: Props) {
  return (
    <Box
      sx={{
        m: 0,
        p: 0,
        width: "100vw",
        backgroundColor: "#7e57c2",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Box maxWidth={1000} width="100%" display="flex" alignItems="center" flexDirection="column">
        <FakeAppBar user={user} />
        <Typography level="h1" sx={{ fontSize: 72, color: "white", mt: 5 }}>
          ChatTriggers
        </Typography>
        <Typography level="title-lg" sx={{ mt: 2, mb: 4, color: "white" }}>
          A Minecraft framework for live scripting using JavaScript.
        </Typography>
        <Box width="100%" maxWidth={500}>
          <SearchBar placeholder="Search Modules" sx={{ mb: 5 }} large />
        </Box>
      </Box>
    </Box>
  );
}

interface NumericStatProps {
  title: string;
  value: number;
}

function NumericStat({ title, value }: NumericStatProps) {
  return (
    <Box sx={{ width: 170 }}>
      <Typography level="body-lg" fontSize={36} sx={{ textAlign: "center" }}>
        {value.toLocaleString()}
      </Typography>
      <Typography sx={{ width: "100%", textAlign: "center" }}>{title}</Typography>
    </Box>
  );
}

// Recalculate the home page info every 5 minutes
const cachedStats = cached(5 * 60 * 1000, async () => {
  const db = await getDb();
  const moduleRepo = db.getRepository(Module);
  const releaseRepo = db.getRepository(Release);

  // TODO: I can do this in one query with raw SQL, but can't seem to manage it with TypeORM. There
  //       has to be a way...
  const newModuleIds = (
    await releaseRepo
      .createQueryBuilder("release")
      .leftJoinAndSelect("release.module", "module")
      .select(["module.id", "module.created_at"])
      .distinct(true)
      .orderBy("module.created_at", "DESC")
      .limit(10)
      .getRawMany()
  ).map(m => m.module_id);

  const newModules = await moduleRepo.find({
    where: {
      id: In(newModuleIds),
    },
    order: {
      created_at: "desc",
    },
    relations: {
      releases: true,
    },
  });

  // TODO: Verify creating a release actually update Module.updated_at
  const updatedModuleIds = (
    await releaseRepo
      .createQueryBuilder("release")
      .leftJoinAndSelect("release.module", "module")
      .select(["module.id", "module.updated_at"])
      .distinct(true)
      .orderBy("module.updated_at", "DESC")
      .limit(10)
      .getRawMany()
  ).map(m => m.module_id);

  const updatedModules = await moduleRepo.find({
    where: {
      id: In(updatedModuleIds),
    },
    order: {
      updated_at: "desc",
    },
    relations: {
      releases: true,
    },
  });

  // Modules can't have downloads without releases, so no need to check for that
  const popularModules = await moduleRepo.find({
    order: { downloads: "desc" },
    take: 10,
    relations: {
      releases: true,
    },
  });

  // GitHub info for release cards
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  const legacyVersion = await octokit.repos.listReleases({
    owner: "ChatTriggers",
    repo: "ChatTriggers",
    per_page: 1,
  });
  const ctjsVersion = await octokit.repos.listReleases({
    owner: "ChatTriggers",
    repo: "ctjs",
    per_page: 1,
  });

  // TODO: Eventually put beta first, and change the name
  return {
    stats: await getStats(),
    newModules,
    updatedModules,
    popularModules,
    git: {
      legacy: {
        version: legacyVersion.data[0].tag_name,
        releaseUrl: legacyVersion.data[0].html_url,
        jarUrl: legacyVersion.data[0].assets.find(a => a.name.endsWith(".jar"))!
          .browser_download_url,
        createdAt: legacyVersion.data[0].published_at!,
        title: "Forge for MC 1.8.9",
      },
      ctjs: {
        version: ctjsVersion.data[0].tag_name,
        releaseUrl: ctjsVersion.data[0].html_url,
        jarUrl: ctjsVersion.data[0].assets.find(a => a.name.endsWith(".jar"))!.browser_download_url,
        createdAt: ctjsVersion.data[0].published_at!,
        title: "Fabric for MC 1.20.4 (Beta)",
      },
    },
  };
});

function ModuleCard({ module }: { module: Module }) {
  return (
    <Link href={`/modules/${module.name}`} style={{ textDecoration: "none" }}>
      <Sheet
        variant="soft"
        sx={{
          my: 1,
          mx: 5,
          p: 2,
          borderRadius: 5,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          <Typography sx={{ textAlign: "start" }}>{module.name}</Typography>
          <Box sx={{ display: "flex", gap: 1, verticalAlign: "center" }}>
            <Typography sx={{ fontSize: 12, width: 25 }}>
              {module.releases.at(-1)?.release_version}
            </Typography>
            <Typography sx={{ fontSize: 12 }}> | </Typography>
            <Typography sx={{ fontSize: 12 }}>{module.user.name}</Typography>
          </Box>
        </Box>
        <ChevronRight />
      </Sheet>
    </Link>
  );
}

function GettingStartedSection() {
  return <Box id="getting-started"></Box>;
}

interface DownloadSectionProps {
  legacy: GitInfo;
  ctjs: GitInfo;
}

function DownloadSection({ legacy, ctjs }: DownloadSectionProps) {
  return (
    <Box
      id="downloads"
      sx={{
        mt: 5,
      }}
    >
      <Typography level="title-lg" sx={{ textAlign: "center", mb: 2, fontSize: 32 }}>
        Downloads
      </Typography>
      <Box
        sx={{
          display: "flex",
          gap: 4,
        }}
      >
        <DownloadComponent git={legacy} />
        <DownloadComponent git={ctjs} />
      </Box>
    </Box>
  );
}

export default async function Page() {
  const session = getSessionFromCookies(cookies());
  const db = await getDb();
  const user = session ? await db.getRepository(User).findOneBy({ id: session.id }) : undefined;
  const { stats, newModules, updatedModules, popularModules, git } = await cachedStats();

  return (
    <>
      <Header user={user?.publicAuthenticated()} />
      <Box
        sx={{
          mt: 7,
          p: 0,
          width: "100vw",
          display: "flex",
          alignItems: "center",
          justifyItems: "center",
          alignContent: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 1000,
            display: "flex",
            alignItems: "center",
            justifyItems: "center",
            alignContent: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              display: "flex",
              gap: { mobile: 2, tablet: 4 },
              flexDirection: { mobile: "column", tablet: "row" },
            }}
          >
            <Button
              startDecorator={<Book />}
              sx={{ fontSize: 18 }}
              component="a"
              href="#getting-started"
            >
              Getting Started
            </Button>
            <Button
              startDecorator={<Download />}
              sx={{ fontSize: 18 }}
              component="a"
              href="#download"
            >
              Download
            </Button>
            <Button startDecorator={<Code />} sx={{ fontSize: 18 }} component="a" href="/modules">
              Modules
            </Button>
          </Box>
          <Divider sx={{ mt: 4, width: "70%", left: "15%" }} />
          <Box
            sx={{
              mt: 3,
              display: "flex",
              flexDirection: { mobile: "column", tablet: "row" },
              alignItems: "center",
              justifyItems: "center",
              alignContent: "center",
              justifyContent: "center",
              gap: { mobile: 1, tablet: 4 },
            }}
          >
            <NumericStat title="Imports" value={stats.totalImports} />
            <NumericStat title="Modules" value={stats.moduleCount} />
            <NumericStat title="Releases" value={stats.releaseCount} />
          </Box>
          <Grid container sx={{ mt: 5 }}>
            <Grid xs={4}>
              <Typography level="body-lg" sx={{ textAlign: "center", fontSize: 22 }}>
                <b>Most Imported</b>
              </Typography>
            </Grid>
            <Grid xs={4}>
              <Typography level="body-lg" sx={{ textAlign: "center", fontSize: 22 }}>
                <b>Recently Updated</b>
              </Typography>
            </Grid>
            <Grid xs={4}>
              <Typography level="body-lg" sx={{ textAlign: "center", fontSize: 22 }}>
                <b>Recently Created</b>
              </Typography>
            </Grid>
            <Grid xs={12} sx={{ mb: 3 }} />
            {[...Array(10).keys()].map(i => {
              return (
                <Fragment key={i}>
                  <Grid xs={4}>
                    <ModuleCard module={popularModules[i]} />
                  </Grid>
                  <Grid xs={4}>
                    <ModuleCard module={updatedModules[i]} />
                  </Grid>
                  <Grid xs={4}>
                    <ModuleCard module={newModules[i]} />
                  </Grid>
                </Fragment>
              );
            })}
          </Grid>
          <Divider sx={{ mt: 4, width: "70%", left: "15%" }} />
          <DownloadSection legacy={git.legacy} ctjs={git.ctjs} />
          <GettingStartedSection />
          <Box sx={{ height: 400 }} />
        </Box>
      </Box>
    </>
  );
}
