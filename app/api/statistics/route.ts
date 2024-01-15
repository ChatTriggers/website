import { route } from "db/utils/route";
import { getStats } from "db/utils/stats";

export const GET = route(async () => {
  const stats = await getStats();
  return Response.json({
    module_count: stats.moduleCount,
    release_count: stats.releaseCount,
    total_imports: stats.totalImports,
  });
});
