// Types + pure helpers shared by the API (server) and the cached client-side bundle.

export const DAY = 86_400_000;

/** [uid, email, name, createdMs, lastSeenMs, disabled(0|1), flags(bitmask, see F), signInMethod(0 apple,1 google,2 email,3 other)] */
export type UserTuple = [string, string, string, number, number, 0 | 1, number, number];

/** Bits packed into UserTuple[6]. */
export const F = {
  VERIFIED: 1, NAME: 2, PHOTO: 4, GENDER: 8, FAV: 16, LOC: 32, VIEWED: 64, LIKED: 128,
  CHATTED: 256, REQUESTED: 512, POSTED: 1024, PUSH: 2048, REPORTED: 4096, NOTIF_OFF: 8192,
} as const;
export const PROFILE_BITS = F.NAME | F.PHOTO | F.GENDER | F.FAV;
export const METHOD_LABELS = ["Apple", "Google", "Email", "Other"] as const;
export const hasF = (t: UserTuple, f: number) => (t[6] & f) !== 0;

export interface PetRow {
  id: string;
  name: string;
  category: string;
  status: string;
  gender: string;
  owner: string;
  photo: string;
  created: number;
}
export interface GeoUser {
  uid: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface Stats {
  timezoneOffsetMin: number;
  totals: {
    users: number; pets: number; activePets: number; likes: number; chats: number; posts: number;
    adoptionRequests: Record<string, number>; reportsPending: number; usersWithPushToken: number; usersWithLocation: number;
  };
  signups: { today: number; last7: number; prev7: number; last30: number; prev30: number; series: { date: string; count: number }[] };
  activeUsers: { last1: number; last7: number; last30: number };
  inactive: { neverEngaged: number; notSeen30d: number; neverReturned: number };
  funnel: { signedUp: number; listedPet: number; liked: number; chatted: number; requested: number; approved: number };
  activity: { date: string; newUsers: number; petsListed: number; likes: number; chats: number; requests: number; posts: number }[];
  petsByCategory: Record<string, number>;
  petsByStatus: Record<string, number>;
  topListers: { uid: string; count: number; email: string; name: string }[];
  geography: {
    total: number;
    noLocation: number; // users who never shared a location
    unknownCountry: number; // shared a location but the country could not be read
    byCountry: { country: string; count: number; q: string }[]; // q = address text to filter users by
  };
}

export interface Bundle {
  v: 2;
  generatedAt: number;
  stats: Stats;
  users: UserTuple[];
  geo: GeoUser[];
  pets: PetRow[];
  engaged: string[];
}

export const USER_FILTERS = [
  { key: "all", label: "All" },
  { key: "new7", label: "New · 7 days" },
  { key: "new30", label: "New · 30 days" },
  { key: "active7", label: "Active · 7 days" },
  { key: "never-engaged", label: "Never used a feature" },
  { key: "never-returned", label: "Never came back" },
  { key: "inactive30", label: "Inactive 30+ days" },
  { key: "has-pets", label: "Has pets" },
] as const;
export type UserFilterKey = (typeof USER_FILTERS)[number]["key"];

export interface FilterCtx {
  now: number;
  engaged: Set<string>;
  petCount: Map<string, number>;
}

export function matchesFilter(key: string, u: UserTuple, c: FilterCtx): boolean {
  const [uid, , , created, lastSeen] = u;
  switch (key) {
    case "new7": return c.now - created < 7 * DAY;
    case "new30": return c.now - created < 30 * DAY;
    case "active7": return c.now - lastSeen < 7 * DAY;
    case "never-engaged": return !c.engaged.has(uid);
    case "never-returned": return lastSeen - created < DAY;
    case "inactive30": return c.now - lastSeen >= 30 * DAY;
    case "has-pets": return c.petCount.has(uid);
    default: return true;
  }
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const ALIASES: Record<string, string> = {
  usa: "United States", "u.s.a.": "United States", "u.s.": "United States", us: "United States", "united states": "United States",
  "united states of america": "United States", uk: "United Kingdom", "u.k.": "United Kingdom", "united kingdom": "United Kingdom",
  england: "United Kingdom", scotland: "United Kingdom", wales: "United Kingdom", "northern ireland": "United Kingdom",
  uae: "United Arab Emirates", "united arab emirates": "United Arab Emirates", "south korea": "South Korea", "republic of korea": "South Korea",
};

/** Google-Places style addresses end with the country ("…, Mumbai, Maharashtra, India"). */
export function countryFromAddress(address: string): { country: string; raw: string } | null {
  const parts = address.split(",").map((x) => x.trim()).filter(Boolean);
  const raw = parts[parts.length - 1];
  if (!raw || /\d/.test(raw) || raw.length > 40) return null;
  const key = raw.toLowerCase();
  return { country: ALIASES[key] ?? raw.replace(/\b\w/g, (c) => c.toUpperCase()), raw };
}


// ---------------------------------------------------------------------------
// Combinable admin filters for the Users page (AND across facets).
// ---------------------------------------------------------------------------
export interface FacetCtx { now: number; engaged: Set<string>; petCount: Map<string, number> }
export interface FacetOption { value: string; label: string; test: (t: UserTuple, c: FacetCtx) => boolean }
export interface Facet { key: string; label: string; hint?: string; options: FacetOption[] }

const lacks = (bit: number) => (t: UserTuple) => !hasF(t, bit);
export const FACETS: Facet[] = [
  { key: "act", label: "Activity", hint: "What the user has actually done in the app", options: [
    { value: "engaged", label: "Engaged (used a feature)", test: (t, c) => c.engaged.has(t[0]) },
    { value: "none", label: "Not engaged", test: (t, c) => !c.engaged.has(t[0]) },
    { value: "listed", label: "Listed a pet", test: (t, c) => (c.petCount.get(t[0]) ?? 0) > 0 },
    { value: "viewed", label: "Viewed a pet", test: (t) => hasF(t, F.VIEWED) },
    { value: "noview", label: "Never viewed a pet", test: lacks(F.VIEWED) },
    { value: "browsed", label: "Browsed only (viewed, never acted)", test: (t, c) => hasF(t, F.VIEWED) && !hasF(t, F.LIKED | F.CHATTED | F.REQUESTED) && !(c.petCount.get(t[0]) ?? 0) },
    { value: "liked", label: "Liked a pet", test: (t) => hasF(t, F.LIKED) },
    { value: "chatted", label: "Started a chat", test: (t) => hasF(t, F.CHATTED) },
    { value: "nochat", label: "Never chatted", test: lacks(F.CHATTED) },
    { value: "requested", label: "Requested adoption", test: (t) => hasF(t, F.REQUESTED) },
    { value: "posted", label: "Posted in community", test: (t) => hasF(t, F.POSTED) },
  ] },
  { key: "prof", label: "Profile", hint: "Name, photo, gender and favourite pet are required before a user sees any pet", options: [
    { value: "complete", label: "Complete", test: (t) => (t[6] & PROFILE_BITS) === PROFILE_BITS },
    { value: "incomplete", label: "Incomplete", test: (t) => (t[6] & PROFILE_BITS) !== PROFILE_BITS },
    { value: "nophoto", label: "Missing photo", test: lacks(F.PHOTO) },
    { value: "nogender", label: "Missing gender", test: lacks(F.GENDER) },
    { value: "nofav", label: "Missing favourite pet", test: lacks(F.FAV) },
    { value: "noname", label: "Missing name", test: lacks(F.NAME) },
  ] },
  { key: "meth", label: "Sign-in method", options: [
    { value: "apple", label: "Apple", test: (t) => t[7] === 0 },
    { value: "google", label: "Google", test: (t) => t[7] === 1 },
    { value: "email", label: "Email", test: (t) => t[7] === 2 },
  ] },
  { key: "loc", label: "Location", options: [
    { value: "shared", label: "Shared a location", test: (t) => hasF(t, F.LOC) },
    { value: "none", label: "No location", test: lacks(F.LOC) },
  ] },
  { key: "acct", label: "Account & reach", options: [
    { value: "unverified", label: "Email not verified", test: lacks(F.VERIFIED) },
    { value: "disabled", label: "Disabled", test: (t) => t[5] === 1 },
    { value: "reported", label: "Reported by others", test: (t) => hasF(t, F.REPORTED) },
    { value: "push", label: "Can receive push", test: (t) => hasF(t, F.PUSH) },
    { value: "nopush", label: "No push device", test: lacks(F.PUSH) },
    { value: "notifoff", label: "Turned notifications off", test: (t) => hasF(t, F.NOTIF_OFF) },
  ] },
  { key: "seen", label: "Last active", hint: "Approximate: last sign-in or token refresh", options: [
    { value: "day", label: "Last 24 hours", test: (t, c) => c.now - t[4] < DAY },
    { value: "week", label: "1 – 7 days ago", test: (t, c) => c.now - t[4] >= DAY && c.now - t[4] < 7 * DAY },
    { value: "month", label: "7 – 30 days ago", test: (t, c) => c.now - t[4] >= 7 * DAY && c.now - t[4] < 30 * DAY },
    { value: "old", label: "30+ days ago", test: (t, c) => c.now - t[4] >= 30 * DAY },
  ] },
  { key: "pets", label: "Pets owned", options: [
    { value: "none", label: "None", test: (t, c) => !(c.petCount.get(t[0]) ?? 0) },
    { value: "some", label: "1 or more", test: (t, c) => (c.petCount.get(t[0]) ?? 0) >= 1 },
    { value: "many", label: "3 or more", test: (t, c) => (c.petCount.get(t[0]) ?? 0) >= 3 },
  ] },
];

/** One-click lists an admin is likely to act on. Each sets several facets at once. */
export const PRESETS: { label: string; hint: string; set: Record<string, string> }[] = [
  { label: "Stuck at profile setup", hint: "Signed up but never finished the profile", set: { prof: "incomplete" } },
  { label: "Apple users blocked on photo", hint: "Apple gives no photo, and the app requires one", set: { meth: "apple", prof: "nophoto" } },
  { label: "Profile done, never saw a pet", hint: "Finished setup but never viewed a pet", set: { prof: "complete", act: "noview" } },
  { label: "Pet owners nobody chatted with", hint: "Listed a pet but never started a chat", set: { pets: "some", act: "nochat" } },
  { label: "Lapsed engaged users", hint: "Used a feature, not seen for 30+ days", set: { act: "engaged", seen: "old" } },
  { label: "Located but never engaged", hint: "Shared a location, did nothing else", set: { loc: "shared", act: "none" } },
  { label: "Reported users", hint: "Other users reported them", set: { acct: "reported" } },
  { label: "Unreachable by push", hint: "No registered device", set: { acct: "nopush", seen: "week" } },
];

export function matchesFacets(t: UserTuple, c: FacetCtx, sel: Record<string, string>): boolean {
  for (const f of FACETS) {
    const v = sel[f.key];
    if (!v) continue;
    const o = f.options.find((x) => x.value === v);
    if (o && !o.test(t, c)) return false;
  }
  return true;
}
