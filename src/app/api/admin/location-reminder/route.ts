import { HttpError, adminDb, adminMessaging, handle, requireAdmin } from "@/lib/server/admin";
import { fetchGeoUsers } from "@/lib/server/data";

export const maxDuration = 300;
const COOLDOWN = 7 * 24 * 3_600_000; // one reminder per week, enforced server-side
const meta = () => adminDb().doc("AppConfig/pushes");

interface Audience { tokens: string[]; users: number; optedOut: number; withLocation: number }
let cache: { at: number; data: Promise<Audience> } | null = null;

/** Devices of users who have NO saved location and have not switched notifications off. */
function audience(force = false): Promise<Audience> {
  if (!force && cache && Date.now() - cache.at < 5 * 60_000) return cache.data;
  const p = (async (): Promise<Audience> => {
    const db = adminDb();
    const [tokens, off, geo] = await Promise.all([
      db.collectionGroup("fcm_tokens").select("fcm_token").get(),
      db.collectionGroup("Preferences").select("Notification").get(), // no index needed; filtered below
      fetchGeoUsers(),
    ]);
    const optedOut = new Set(off.docs.filter((d) => d.get("Notification") === false).map((d) => d.ref.parent.parent?.id).filter(Boolean) as string[]);
    const located = new Set(geo.map((g) => g.uid));
    const out = new Set<string>();
    const users = new Set<string>();
    for (const d of tokens.docs) {
      const uid = d.ref.parent.parent?.id;
      const t = d.get("fcm_token") as string | undefined;
      if (!uid || !t || located.has(uid) || optedOut.has(uid)) continue;
      out.add(t);
      users.add(uid);
    }
    return { tokens: [...out], users: users.size, optedOut: optedOut.size, withLocation: located.size };
  })();
  cache = { at: Date.now(), data: p };
  p.catch(() => { if (cache?.data === p) cache = null; });
  return p;
}

const ts = (v: unknown) => (v && typeof (v as { toMillis?: unknown }).toMillis === "function" ? (v as { toMillis(): number }).toMillis() : null);

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const [a, m] = await Promise.all([audience(), meta().get()]);
  return { users: a.users, devices: a.tokens.length, optedOut: a.optedOut, withLocation: a.withLocation, lastSentAt: ts(m.get("lastLocationReminderAt")), cooldownDays: COOLDOWN / 86_400_000 };
});

/** `testUid` sends only to that user's devices. A real send needs confirm "SEND" and the weekly cooldown. */
export const POST = handle(async (req) => {
  await requireAdmin(req);
  const b = (await req.json().catch(() => null)) as { testUid?: string; title?: string; body?: string; confirm?: string } | null;
  const title = (b?.title ?? "See pets near you").trim().slice(0, 80);
  const body = (b?.body ?? "Share your location to discover pets nearby.").trim().slice(0, 180);
  let tokens: string[];
  if (b?.testUid) {
    const s = await adminDb().collection(`Users/${b.testUid}/fcm_tokens`).get();
    tokens = [...new Set(s.docs.map((d) => d.get("fcm_token") as string).filter(Boolean))];
    if (!tokens.length) throw new HttpError(404, "That user has no registered devices.");
  } else {
    if (b?.confirm !== "SEND") throw new HttpError(400, "Type SEND to confirm.");
    const last = ts((await meta().get()).get("lastLocationReminderAt"));
    if (last && Date.now() - last < COOLDOWN) throw new HttpError(429, `A reminder was already sent ${Math.floor((Date.now() - last) / 86_400_000)} day(s) ago. Wait ${COOLDOWN / 86_400_000} days between reminders.`);
    tokens = (await audience(true)).tokens;
    if (!tokens.length) throw new HttpError(404, "No devices match.");
    await meta().set({ lastLocationReminderAt: new Date() }, { merge: true }); // claim the cooldown first
  }
  let sent = 0, failed = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const r = await adminMessaging().sendEachForMulticast({ tokens: tokens.slice(i, i + 500), notification: { title, body } });
    sent += r.successCount;
    failed += r.failureCount;
  }
  return { devices: tokens.length, sent, failed, test: !!b?.testUid };
});
