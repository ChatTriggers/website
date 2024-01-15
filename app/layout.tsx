import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import "swagger-ui-react/swagger-ui.css";
import "reflect-metadata";

import { CssBaseline } from "@mui/joy";
import { db, User } from "app/api/db";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { getSessionFromCookies } from "./api";
import AppBar from "./appbar/AppBar";
import ThemeRegistry from "./ThemeRegistry";

export const metadata: Metadata = {
  title: "ChatTriggers",
};

interface Props {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: Props) {
  const session = getSessionFromCookies(cookies());
  const user = session ? await db.getRepository(User).findOneBy({ id: session.id }) : undefined;

  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
          <CssBaseline />
          <AppBar user={user?.publicAuthenticated()}>{children}</AppBar>
        </ThemeRegistry>
      </body>
    </html>
  );
}
