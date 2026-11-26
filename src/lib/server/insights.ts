import { adminAuth, adminDb } from "./admin";
import { people, refId, ms, who } from "./serialize";
import { DAY, countryFromAddress } from "../shared";
import type { Group, Insights, Person, Stage } from "../insightTypes";

const TTL = 60 * 60_000; // 1h server cache; the admin can force a refresh
const cache = new Map<string, { at: number; data: Promise<Insights> }>();
const isTest = (email: string) => email.toLowerCase().endsWith("@brilworks.com");

export function getInsights(excludeTest: boolean, force = false): Promise<Insights> {
  const k = excludeTest ? "ex" : "all";
  const hit = cache.get(k);
  if (!force && hit && Date.now() - hit.at < TTL) return hit.data;
  if (force && hit && Date.now() - hit.at < 30_000) return hit.data; // ignore refresh spam
  const p = build(excludeTest);
  cache.set(k, { at: Date.now(), data: p });
  p.catch(() => { if (cache.get(k)?.data === p) cache.delete(k); });
  return p;
}

interface A { uid: string; email: string; created: number; seen: number; verified: boolean; group: Group }
const weekStart = (ms0: number) => { const d = new Date(ms0); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); };
const inc = (o: Record<string, number>, k: string, n = 1) => { o[k || "unknown"] = (o[k || "unknown"] ?? 0) + n; };

async function build(excludeTest: boolean): Promise<Insights> {
  const now = Date.now();
  const db = adminDb();

  // ---- Auth users
  const auth: A[] = [];
  let tok: string | undefined;
  do {
    const page = await adminAuth().listUsers(1000, tok);
    for (const u of page.users) {
      const created = Date.parse(u.metadata.creationTime) || 0;
      const seen = Math.max(Date.parse(u.metadata.lastSignInTime) || 0, Date.parse(u.metadata.lastRefreshTime ?? "") || 0, created);
      const ids = u.providerData.map((p) => p.providerId);
      const group: Group = ids.includes("apple.com") ? "apple" : ids.includes("google.com") ? "google" : ids.includes("password") ? "email" : "other";
      auth.push({ uid: u.uid, email: u.email ?? "", created, seen, verified: u.emailVerified, group });
    }
    tok = page.pageToken;
  } while (tok);
  const testAll = auth.filter((a) => isTest(a.email));
  const skip = new Set(excludeTest ? testAll.map((a) => a.uid) : []);
  const users = auth.filter((a) => !skip.has(a.uid));

  // ---- Firestore collections (field-masked)
  const [uDocs, pets, likes, chats, reqs, reports, posts] = await Promise.all([
    db.collection("Users").select("display_name", "photo_url", "Gender", "FavoritePet", "location", "viewed_pet", "Address").get(),
    db.collection("Pets").select("name", "category", "adoption_status", "owner_ref", "pet_medias").get(),
    db.collection("Likes").select("user_ref", "pet_ref").get(),
    db.collection("Chats").select("participants").get(),
    db.collection("AdoptionRequests").select("user_id", "owner_id", "pet_id", "status", "requested_at").get(),
    db.collection("Reports").get(),
    db.collection("Post").select("caption", "user", "created_at", "report_count", "photo_url").get(),
  ]);

  const has = { name: new Set<string>(), photo: new Set<string>(), gender: new Set<string>(), fav: new Set<string>(), loc: new Set<string>(), viewed: new Set<string>() };
  const country = new Map<string, string>();
  for (const d of uDocs.docs) {
    if (skip.has(d.id)) continue;
    if (d.get("display_name")) has.name.add(d.id);
    if (d.get("photo_url")) has.photo.add(d.id);
    if (d.get("Gender")) has.gender.add(d.id);
    if (d.get("FavoritePet")) has.fav.add(d.id);
    if (d.get("location")) has.loc.add(d.id);
    if ((d.get("viewed_pet") ?? []).length) has.viewed.add(d.id);
    const c = countryFromAddress(d.get("Address") ?? "");
    if (c) country.set(d.id, c.country);
  }
  const complete = new Set([...has.name].filter((u) => has.photo.has(u) && has.gender.has(u) && has.fav.has(u)));

  const keep = (uid: string) => !skip.has(uid);
  const listed = new Set<string>(), liked = new Set<string>(), chatted = new Set<string>(), requested = new Set<string>();
  const petRows = pets.docs.filter((p) => keep(refId(p.get("owner_ref"))));
  petRows.forEach((p) => listed.add(refId(p.get("owner_ref"))));
  const likesPerPet = new Map<string, number>();
  likes.docs.forEach((l) => {
    const u = refId(l.get("user_ref"));
    if (!keep(u)) return;
    liked.add(u);
    const p = refId(l.get("pet_ref"));
    if (p) likesPerPet.set(p, (likesPerPet.get(p) ?? 0) + 1);
  });
  chats.docs.forEach((c) => ((c.get("participants") ?? []) as unknown[]).map(refId).forEach((u) => keep(u) && chatted.add(u)));
  const reqsKeep = reqs.docs.filter((r) => keep(refId(r.get("user_id"))) && keep(refId(r.get("owner_id"))));
  reqsKeep.forEach((r) => requested.add(refId(r.get("user_id"))));
  const requestsPerPet = new Map<string, number>();
  reqsKeep.forEach((r) => { const p = refId(r.get("pet_id")); if (p) requestsPerPet.set(p, (requestsPerPet.get(p) ?? 0) + 1); });

  // ---- Stages (overall + by sign-in method)
  const mk = (key: string, label: string, pred: (a: A) => boolean): Stage => {
    const by: Record<Group, number> = { apple: 0, google: 0, email: 0, other: 0 };
    let overall = 0;
    for (const a of users) if (pred(a)) { overall++; by[a.group]++; }
    return { key, label, overall, by };
  };
  const stages: Stage[] = [
    mk("signup", "Signed up", () => true),
    mk("verified", "Email verified", (a) => a.verified),
    mk("name", "Has a name", (a) => has.name.has(a.uid)),
    mk("photo", "Has a profile photo", (a) => has.photo.has(a.uid)),
    mk("gender", "Chose a gender", (a) => has.gender.has(a.uid)),
    mk("fav", "Chose a favourite pet", (a) => has.fav.has(a.uid)),
    mk("complete", "Profile complete (name, photo, gender, favourite pet)", (a) => complete.has(a.uid)),
    mk("location", "Shared a location", (a) => has.loc.has(a.uid)),
    mk("viewed", "Viewed at least one pet", (a) => has.viewed.has(a.uid)),
    mk("liked", "Liked a pet", (a) => liked.has(a.uid)),
    mk("chatted", "Started a chat", (a) => chatted.has(a.uid)),
    mk("requested", "Requested adoption", (a) => requested.has(a.uid)),
  ];
  const byGroup: Record<Group, number> = { apple: 0, google: 0, email: 0, other: 0 };
  users.forEach((a) => byGroup[a.group]++);

  // ---- How long accounts lasted after signup (last seen − created; approximate)
  const buckets = [["Under 1 hour", 3_600_000], ["1 hour – 1 day", DAY], ["1 – 3 days", 3 * DAY], ["3 – 7 days", 7 * DAY], ["7 – 30 days", 30 * DAY], ["30+ days", Infinity]] as const;
  const ttl = buckets.map(([label]) => ({ label, count: 0 }));
  users.forEach((a) => { const l = a.seen - a.created; ttl[buckets.findIndex(([, max]) => l < max)].count++; });

  // ---- Retention by signup week (only users old enough for each window)
  const weeks = new Map<string, { n: number; e1: number; r1: number; e7: number; r7: number; e30: number; r30: number }>();
  for (const a of users) {
    const w = weekStart(a.created);
    const e = weeks.get(w) ?? { n: 0, e1: 0, r1: 0, e7: 0, r7: 0, e30: 0, r30: 0 };
    const age = now - a.created, life = a.seen - a.created;
    e.n++;
    if (age >= DAY) { e.e1++; if (life >= DAY) e.r1++; }
    if (age >= 7 * DAY) { e.e7++; if (life >= 7 * DAY) e.r7++; }
    if (age >= 30 * DAY) { e.e30++; if (life >= 30 * DAY) e.r30++; }
    weeks.set(w, e);
  }
  const pc = (r: number, e: number) => (e >= 20 ? Math.round((r / e) * 1000) / 10 : null);
  // Only the latest visit is stored, so "still seen N days after signing up" keeps
  // rising for weeks. A figure is settled once every user of that week has had the
  // N days plus four more weeks to come back; until then it reads lower than it will.
  const settled = (week: string, days: number) => now - (Date.parse(week) + 7 * DAY) >= (days + 28) * DAY;
  const retention = [...weeks].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-20).map(([week, e]) => ({
    week, users: e.n, d1: pc(e.r1, e.e1), d7: pc(e.r7, e.e7), d30: pc(e.r30, e.e30),
    early: { d1: !settled(week, 1), d7: !settled(week, 7), d30: !settled(week, 30) },
  }));

  // ---- Supply
  const petsByCategory: Record<string, number> = {}, petsByStatus: Record<string, number> = {};
  const ctry = new Map<string, { pets: number; owners: Set<string> }>();
  const petsPerWeek = new Map<string, number>();
  for (const p of petRows) {
    inc(petsByCategory, String(p.get("category") ?? "").toLowerCase());
    const st = String(p.get("adoption_status") ?? ""); inc(petsByStatus, st === "Deactive" ? "Deactivated" : st);
    const o = refId(p.get("owner_ref"));
    const c = country.get(o) ?? "Unknown (owner shared no location)";
    const e = ctry.get(c) ?? { pets: 0, owners: new Set() }; e.pets++; e.owners.add(o); ctry.set(c, e);
    const wk = weekStart(p.createTime?.toMillis() ?? 0); petsPerWeek.set(wk, (petsPerWeek.get(wk) ?? 0) + 1);
  }
  const requestsByStatus: Record<string, number> = {};
  const pendingAge = { under3d: 0, d3to7: 0, d7to14: 0, over14d: 0 };
  const perOwner = new Map<string, { pending: number; oldest: number }>();
  for (const r of reqsKeep) {
    const st = String(r.get("status") ?? ""); inc(requestsByStatus, st);
    if (st !== "Pending") continue;
    const at = ms(r.get("requested_at")) ?? now, age = (now - at) / DAY;
    if (age < 3) pendingAge.under3d++; else if (age < 7) pendingAge.d3to7++; else if (age < 14) pendingAge.d7to14++; else pendingAge.over14d++;
    const o = refId(r.get("owner_id")); const e = perOwner.get(o) ?? { pending: 0, oldest: 0 };
    e.pending++; e.oldest = Math.max(e.oldest, age); perOwner.set(o, e);
  }
  const topLikedIds = [...likesPerPet].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const petInfo = new Map(petRows.map((p) => [p.id, { name: p.get("name") ?? "", category: p.get("category") ?? "" }]));
  const petsWithNoLikes = petRows.filter((p) => !likesPerPet.has(p.id)).length;

  // ---- Moderation
  const reportsByStatus: Record<string, number> = {};
  const repDocs = reports.docs.filter((r) => keep(refId(r.get("reporter_ref"))) && keep(refId(r.get("reported_ref"))));
  repDocs.forEach((r) => inc(reportsByStatus, String(r.get("status") ?? "")));
  const openReports = repDocs.filter((r) => (r.get("status") ?? "Pending") === "Pending").sort((a, b) => (ms(b.get("created_at")) ?? 0) - (ms(a.get("created_at")) ?? 0)).slice(0, 50);
  const recentPets = petRows.filter((p) => (p.createTime?.toMillis() ?? 0) > now - 7 * DAY).sort((a, b) => (b.createTime?.toMillis() ?? 0) - (a.createTime?.toMillis() ?? 0)).slice(0, 30);
  const postDocs = posts.docs.filter((p) => keep(refId(p.get("user"))));
  const recentPosts = [...postDocs].sort((a, b) => (ms(b.get("created_at")) ?? 0) - (ms(a.get("created_at")) ?? 0)).slice(0, 20);

  const wanted = new Set<string>([
    ...[...perOwner].sort((a, b) => b[1].pending - a[1].pending).slice(0, 15).map(([u]) => u),
    ...openReports.flatMap((r) => [refId(r.get("reporter_ref")), refId(r.get("reported_ref"))]),
    ...recentPets.map((p) => refId(p.get("owner_ref"))),
    ...recentPosts.map((p) => refId(p.get("user"))),
  ]);
  const P = await people(wanted);
  const person = (uid: string): Person => who(P, uid);

  return {
    generatedAt: now,
    excludeTest,
    testAccounts: testAll.length,
    totals: { users: users.length, byGroup },
    stages,
    timeToLeave: ttl,
    retention,
    supply: {
      petsByCountry: [...ctry].map(([c, e]) => ({ country: c, pets: e.pets, users: e.owners.size })).sort((a, b) => b.pets - a.pets).slice(0, 15),
      petsByCategory, petsByStatus,
      petsPerWeek: [...petsPerWeek].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-8).map(([week, count]) => ({ week, count })),
      requestsByStatus, pendingAge,
      unanswered: [...perOwner].sort((a, b) => b[1].pending - a[1].pending).slice(0, 15).map(([uid, e]) => ({ uid, name: person(uid).name, email: person(uid).email, pending: e.pending, oldestDays: Math.round(e.oldest) })),
      topLiked: topLikedIds.map(([id, n]) => ({ id, name: petInfo.get(id)?.name ?? "", category: petInfo.get(id)?.category ?? "", likes: n, requests: requestsPerPet.get(id) ?? 0 })),
      petsWithNoLikes,
    },
    moderation: {
      reportsByStatus,
      reports: openReports.map((r) => ({ id: r.id, at: ms(r.get("created_at")), status: r.get("status") ?? "", reason: r.get("reason") ?? "", description: r.get("description") ?? "", reporter: person(refId(r.get("reporter_ref"))), reported: person(refId(r.get("reported_ref"))) })),
      recentPets: recentPets.map((p) => { const m = p.get("pet_medias"); return { id: p.id, name: p.get("name") ?? "", category: p.get("category") ?? "", at: p.createTime?.toMillis() ?? null, photo: Array.isArray(m) ? m[0] ?? "" : "", owner: person(refId(p.get("owner_ref"))) }; }),
      recentPosts: recentPosts.map((p) => ({ id: p.id, caption: p.get("caption") ?? "", at: ms(p.get("created_at")), author: person(refId(p.get("user"))), reports: p.get("report_count") ?? 0, photo: p.get("photo_url") ?? "" })),
      testAccountSample: testAll.slice(0, 15).map((a) => ({ uid: a.uid, email: a.email })),
    },
  };
}
