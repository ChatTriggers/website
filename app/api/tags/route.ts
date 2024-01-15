import { getTags } from "db/utils/modules";
import { route } from "db/utils/route";

export const GET = route(async () => {
  return Response.json([...(await getTags())]);
});
