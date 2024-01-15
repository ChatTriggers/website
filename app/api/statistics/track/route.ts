import { route } from "db/utils/route";

// Dummy route that doesn't do anything yet. The mod requires this endpoint to exist, but
// we can figure out what to do with it later.
export const GET = route(async () => new Response());
