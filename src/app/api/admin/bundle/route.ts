import { handle, requireAdmin } from "@/lib/server/admin";
import { getBundle } from "@/lib/server/bundle";

export const maxDuration = 300;

/** The whole browsable dataset in one call. The client caches it for 48h; ?refresh=1 rebuilds. */
export const GET = handle(async (req) => {
  await requireAdmin(req);
  return getBundle(new URL(req.url).searchParams.get("refresh") === "1");
});
