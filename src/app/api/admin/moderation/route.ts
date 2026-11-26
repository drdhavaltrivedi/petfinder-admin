import { handle, requireAdmin } from "@/lib/server/admin";
import { decide, listModeration, parseDecision } from "@/lib/server/moderation";

/** Reported and hidden content. */
export const GET = handle(async (req) => {
  await requireAdmin(req);
  return listModeration();
});

/** Hide, keep, delete or dismiss. */
export const POST = handle(async (req) => {
  const admin = await requireAdmin(req);
  return decide(parseDecision(await req.json().catch(() => null)), admin.uid);
});
