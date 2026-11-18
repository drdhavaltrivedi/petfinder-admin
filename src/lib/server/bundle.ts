import { adminDb } from "./admin";
import { dayKey, fetchAuthUsers, fetchEngagement, fetchGeoUsers, TZ_MIN } from "./data";
import { DAY, countryFromAddress, type Bundle, type Stats, type UserTuple } from "../shared";

// One bundle = everything the panel browses (users, pets, stats). The browser caches it for
// 48h and does all filtering/paging locally. This server-side copy only dedupes concurrent
// builds and serves other tabs/admins while the instance is warm.
const TTL = 48 * 3_600_000;
let cache: { at: number; data: Promise<Bundle> } | null = null;

export function getBundle(force = false): Promise<Bundle> {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.data;
  if (force && cache && Date.now() - cache.at < 30_000) return cache.data; // ignore refresh spam
  const p = build();
  cache = { at: Date.now(), data: p };
  p.catch(() => { if (cache?.data === p) cache = null; });
  return p;
}

function series(days: number, now: number, stamps: number[]) {
  const m = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) m.set(dayKey(now - i * DAY), 0);
  for (const t of stamps) {
    const k = dayKey(t);
    if (m.has(k)) m.set(k, m.get(k)! + 1);
  }
  return m;
}
const countBy = <T,>(arr: T[], key: (x: T) => string) => {
  const o: Record<string, number> = {};
  arr.forEach((x) => { const k = key(x) || "unknown"; o[k] = (o[k] ?? 0) + 1; });
  return o;
};

async function build(): Promise<Bundle> {
  const now = Date.now();
  const db = adminDb();
  const [users, eng, geo, push, reportsPending] = await Promise.all([
    fetchAuthUsers(),
    fetchEngagement(),
    fetchGeoUsers(),
    db.collectionGroup("fcm_tokens").count().get().then((s) => s.data().count),
    db.collection("Reports").where("status", "==", "Pending").count().get().then((s) => s.data().count),
  ]);

  const created = users.map((u) => u[3]);
  const last = (stamps: number[], days: number, offset = 0) => stamps.filter((t) => now - t >= offset * DAY && now - t < (days + offset) * DAY).length;
  const signupSeries = series(30, now, created);
  const keys = [...series(14, now, []).keys()];
  const mk = (s: number[]) => series(14, now, s);
  const likes = mk(eng.likes), chats = mk(eng.chats), posts = mk(eng.posts), reqs = mk(eng.requests.map((r) => r.at));
  const pets = mk(eng.pets.map((p) => p.created)), newUsers = mk(created);
  const seen = users.map((u) => u[4]);
  const email = new Map<string, UserTuple>(users.map((u) => [u[0], u]));

  const byCountry = new Map<string, { count: number; raws: Map<string, number> }>();
  let unknownCountry = 0;
  for (const g of geo) {
    const c = countryFromAddress(g.address);
    if (!c) { unknownCountry++; continue; }
    const e = byCountry.get(c.country) ?? { count: 0, raws: new Map() };
    e.count++;
    e.raws.set(c.raw, (e.raws.get(c.raw) ?? 0) + 1);
    byCountry.set(c.country, e);
  }

  const stats: Stats = {
    timezoneOffsetMin: TZ_MIN,
    totals: {
      users: users.length,
      pets: eng.pets.length,
      activePets: eng.pets.filter((p) => p.status === "Active").length,
      likes: eng.likes.length,
      chats: eng.chats.length,
      posts: eng.posts.length,
      adoptionRequests: countBy(eng.requests, (r) => r.status),
      reportsPending,
      usersWithPushToken: push,
      usersWithLocation: geo.length,
    },
    signups: {
      today: signupSeries.get(dayKey(now)) ?? 0,
      last7: last(created, 7), prev7: last(created, 7, 7),
      last30: last(created, 30), prev30: last(created, 30, 30),
      series: [...signupSeries].map(([date, count]) => ({ date, count })),
    },
    activeUsers: { last1: last(seen, 1), last7: last(seen, 7), last30: last(seen, 30) },
    inactive: {
      neverEngaged: users.filter((u) => !eng.engaged.has(u[0])).length,
      notSeen30d: users.filter((u) => now - u[4] >= 30 * DAY).length,
      neverReturned: users.filter((u) => u[4] - u[3] < DAY).length,
    },
    funnel: {
      signedUp: users.length,
      listedPet: eng.petCount.size,
      liked: eng.likedUsers.size,
      chatted: eng.chattedUsers.size,
      requested: eng.requestedUsers.size,
      approved: eng.approvedUsers.size,
    },
    activity: keys.map((date) => ({
      date, newUsers: newUsers.get(date) ?? 0, petsListed: pets.get(date) ?? 0, likes: likes.get(date) ?? 0,
      chats: chats.get(date) ?? 0, requests: reqs.get(date) ?? 0, posts: posts.get(date) ?? 0,
    })),
    petsByCategory: countBy(eng.pets, (p) => p.category),
    petsByStatus: countBy(eng.pets, (p) => p.status),
    geography: {
      total: users.length,
      noLocation: Math.max(0, users.length - geo.length),
      unknownCountry,
      byCountry: [...byCountry].sort((a, b) => b[1].count - a[1].count)
        .map(([country, e]) => ({ country, count: e.count, q: [...e.raws].sort((a, b) => b[1] - a[1])[0][0] })),
    },
    topListers: [...eng.petCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([uid, count]) => ({ uid, count, email: email.get(uid)?.[1] ?? "", name: email.get(uid)?.[2] ?? "" })),
  };

  return { v: 1, generatedAt: now, stats, users, geo, pets: eng.pets, engaged: [...eng.engaged] };
}
