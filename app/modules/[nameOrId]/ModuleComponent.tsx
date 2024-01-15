"use client";

import { Box } from "@mui/joy";
import type { AuthenticatedUser, PublicModule } from "db/utils/pub";

import Body from "../Body";
import Header from "../Header";

interface Props {
  module: PublicModule;
  user?: AuthenticatedUser;
}

export default function Module({ module, user }: Props) {
  const isOwner = !!user && module.user?.id === user?.id && user?.emailVerified === true;

  return (
    <Box my={{ md: 5 }} width="100%">
      <Header module={module} ownerView={isOwner} />
      <Body module={module} ownerView={isOwner} />
    </Box>
  );
}
