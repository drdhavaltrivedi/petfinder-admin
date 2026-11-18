import { adminDb, handle, requireAdmin } from "@/lib/server/admin";
import { DAY, dayKey, loadAuthUsers, loadEngagement } from "@/lib/server/data";

export const maxDuration = 120;

function series(days: number, now: number, stamps: number[]) {
  const m = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) m.set(dayKey(now - i * DAY), 0);
  for (const t of stamps) {
    const k = dayKey(t);
    if (m.has(k)) m.set(k, m.get(k)! + 1);
  }
  return m;
}

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const force = new URL(req.url).searchParams.get("refresh") === "1";
  const now = Date.now();
  const [users, eng] = await Promise.all([loadAuthUsers(force), loadEngagement(force)]);
  const db = adminDb();
  const [push, reportsPending] = await Promise.all([
    db.collectionGroup("fcm_tokens").count().get().then((s) => s.data().count),
    db.collection("Reports").where("status", "==", "Pending").count().get().then((s) => s.data().count),
  ]);

  const today = dayKey(now);
  const signups = users.map((u) => u.created);
  const signupSeries = series(30, now, signups);
  const act = series(14, now, []);
  const keys = [...act.keys()];
  const mk = (stamps: number[]) => series(14, now, stamps);
  const likes = mk(eng.likes), chats = mk(eng.chats), posts = mk(eng.posts);
  const reqs = mk(eng.requests.map((r) => r.at)), pets = mk(eng.pets.map((p) => p.created));
  const newUsers = mk(signups);

  const countSince = (f: (u: (typeof users)[number]) => number, days: number) =>
    users.filter((u) => now - f(u) < days * DAY).length;

  const by = <T,>(arr: T[], key: (x: T) => string) => {
    const o: Record<string, number> = {};
    arr.forEach((x) => (o[key(x) || "unknown"] = (o[key(x) || "unknown"] ?? 0) + 1));
    return o;
  };
  const byUid = new Map(users.map((u) => [u.uid, u]));
  const topListers = [...eng.petCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([uid, count]) => ({ uid, count, email: byUid.get(uid)?.email ?? "", name: byUid.get(uid)?.name ?? "" }));

  return {
    generatedAt: now,
    timezoneOffsetMin: Number(process.env.ADMIN_TZ_OFFSET_MIN ?? 330),
    totals: {
      users: users.length,
      pets: eng.pets.length,
      activePets: eng.pets.filter((p) => p.status === "Active").length,
      likes: eng.likes.length,
      chats: eng.chatCount,
      posts: eng.posts.length,
      adoptionRequests: by(eng.requests, (r) => r.status),
      reportsPending,
      usersWithPushToken: push,
    },
    signups: {
      today: signupSeries.get(today) ?? 0,
      last7: countSince((u) => u.created, 7),
      last30: countSince((u) => u.created, 30),
      series: [...signupSeries].map(([date, count]) => ({ date, count })),
    },
    activeUsers: {
      last1: countSince((u) => u.lastSeen, 1),
      last7: countSince((u) => u.lastSeen, 7),
      last30: countSince((u) => u.lastSeen, 30),
    },
    inactive: {
      neverEngaged: users.filter((u) => !eng.engaged.has(u.uid)).length,
      notSeen30d: users.filter((u) => now - u.lastSeen >= 30 * DAY).length,
      neverReturned: users.filter((u) => u.lastSeen - u.created < DAY).length,
    },
    activity: keys.map((date) => ({
      date,
      newUsers: newUsers.get(date) ?? 0,
      petsListed: pets.get(date) ?? 0,
      likes: likes.get(date) ?? 0,
      chats: chats.get(date) ?? 0,
      requests: reqs.get(date) ?? 0,
      posts: posts.get(date) ?? 0,
    })),
    petsByCategory: by(eng.pets, (p) => p.category),
    petsByStatus: by(eng.pets, (p) => p.status),
    topListers,
  };
});
