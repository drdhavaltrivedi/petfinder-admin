import { handle, requireAdmin } from "@/lib/server/admin";
import { getInsights } from "@/lib/server/insights";

export const maxDuration = 300;

/** Decision-support analytics. ?excludeTest=1 hides @brilworks.com accounts; ?refresh=1 rebuilds. */
export const GET = handle(async (req) => {
  await requireAdmin(req);
  const u = new URL(req.url);
  return getInsights(u.searchParams.get("excludeTest") === "1", u.searchParams.get("refresh") === "1" || u.searchParams.has("fresh"));
});
