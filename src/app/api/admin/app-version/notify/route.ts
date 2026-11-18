import { HttpError, adminDb, adminMessaging, handle, requireAdmin } from "@/lib/server/admin";
import { markNotified, readVersionCfg } from "@/lib/server/appversion";

export const maxDuration = 300;
const COOLDOWN = 15 * 60_000;

/**
 * Push "a new version is available" to devices. `testUid` sends only to that user's devices (use it first).
 * A real send needs `confirm: "SEND"` and respects a 15-minute cooldown (stored in Firestore).
 */
export const POST = handle(async (req) => {
  await requireAdmin(req);
  const b = (await req.json().catch(() => null)) as { audience?: "all" | "ios" | "android"; testUid?: string; title?: string; body?: string; confirm?: string } | null;
  const title = (b?.title ?? "A new version of PetFinder is here").trim().slice(0, 80);
  const body = (b?.body ?? "Update the app to get the latest improvements.").trim().slice(0, 180);
  const db = adminDb();

  let docs;
  if (b?.testUid) {
    docs = (await db.collection(`Users/${b.testUid}/fcm_tokens`).get()).docs;
    if (!docs.length) throw new HttpError(404, "That user has no registered devices.");
  } else {
    if (b?.confirm !== "SEND") throw new HttpError(400, 'Type SEND to confirm a push to all users.');
    const last = (await readVersionCfg()).lastNotifiedAt;
    if (last && Date.now() - last < COOLDOWN) throw new HttpError(429, `A push was already sent ${Math.round((Date.now() - last) / 60000)} min ago. Wait 15 minutes between sends.`);
    docs = (await db.collectionGroup("fcm_tokens").get()).docs;
  }

  const want = b?.audience ?? "all";
  const tokens = [...new Set(docs
    .filter((d) => b?.testUid || want === "all" || String(d.get("device_type") ?? "").toLowerCase() === want)
    .map((d) => d.get("fcm_token") as string)
    .filter(Boolean))];
  if (!tokens.length) throw new HttpError(404, "No devices match that audience.");

  if (!b?.testUid) await markNotified(); // claim the cooldown before sending

  let sent = 0, failed = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const r = await adminMessaging().sendEachForMulticast({ tokens: tokens.slice(i, i + 500), notification: { title, body } });
    sent += r.successCount;
    failed += r.failureCount;
  }
  return { devices: tokens.length, sent, failed, test: !!b?.testUid };
});
