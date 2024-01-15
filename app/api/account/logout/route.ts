import { route } from "db/utils/route";
import { setSession } from "db/utils/session";
import { NextResponse } from "next/server";

export const POST = route(async () => {
  const response = new NextResponse("Logged out");
  setSession(response, null);
  return response;
});
