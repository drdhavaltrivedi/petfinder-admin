// Types + pure helpers shared by the API (server) and the cached client-side bundle.

export const DAY = 86_400_000;

/** [uid, email, name, createdMs, lastSeenMs, disabled(0|1)] */
export type UserTuple = [string, string, string, number, number, 0 | 1];

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
  v: 1;
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
