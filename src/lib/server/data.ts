import { Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "./admin";

// Day buckets use this offset from UTC (default IST +05:30).
const TZ_MIN = Number(process.env.ADMIN_TZ_OFFSET_MIN ?? 330);
export const dayKey = (ms: number) => new Date(ms + TZ_MIN * 60_000).toISOString().slice(0, 10);
export const DAY = 86_400_000;
const TTL = 5 * 60_000;

function cached<T>(load: () => Promise<T>) {
  let v: { at: number; data: Promise<T> } | null = null;
  return (force = false) => {
    if (force || !v || Date.now() - v.at > TTL) {
      const p = load();
      v = { at: Date.now(), data: p };
      p.catch(() => (v = null));
    }
    return v!.data;
  };
}

export interface AuthRow {
  uid: string;
  email: string;
  name: string;
  created: number;
  lastSeen: number; // max(last token refresh, last sign-in) – approximate "last active"
  disabled: boolean;
}

export const loadAuthUsers = cached(async (): Promise<AuthRow[]> => {
  const rows: AuthRow[] = [];
  let token: string | undefined;
  do {
    const page = await adminAuth().listUsers(1000, token);
    for (const u of page.users) {
      const created = Date.parse(u.metadata.creationTime) || 0;
      const signIn = Date.parse(u.metadata.lastSignInTime) || 0;
      const refresh = Date.parse(u.metadata.lastRefreshTime ?? "") || 0;
      rows.push({
        uid: u.uid,
        email: u.email ?? "",
        name: u.displayName ?? "",
        created,
        lastSeen: Math.max(signIn, refresh, created),
        disabled: u.disabled,
      });
    }
    token = page.pageToken;
  } while (token);
  return rows;
});

const ms = (t: unknown) => (t instanceof Timestamp ? t.toMillis() : 0);
const rid = (r: unknown) => (r && typeof r === "object" && "id" in r ? (r as DocumentReference).id : "");

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
export interface Engagement {
  pets: PetRow[];
  petCount: Map<string, number>;
  engaged: Set<string>;
  likes: number[];
  chats: number[];
  requests: { at: number; status: string }[];
  posts: number[];
  chatCount: number;
}

export const loadEngagement = cached(async (): Promise<Engagement> => {
  const db = adminDb();
  const [pets, likes, chats, reqs, posts] = await Promise.all([
    db.collection("Pets").select("name", "category", "adoption_status", "gender", "owner_ref", "pet_medias").get(),
    db.collection("Likes").select("user_ref", "created_at").get(),
    db.collection("Chats").select("participants", "created_at").get(),
    db.collection("AdoptionRequests").select("user_id", "owner_id", "status", "requested_at").get(),
    db.collection("Post").select("user", "created_at").get(),
  ]);
  const engaged = new Set<string>();
  const petCount = new Map<string, number>();
  const petRows: PetRow[] = pets.docs.map((d) => {
    const owner = rid(d.get("owner_ref"));
    if (owner) {
      engaged.add(owner);
      petCount.set(owner, (petCount.get(owner) ?? 0) + 1);
    }
    const media = d.get("pet_medias");
    return {
      id: d.id,
      name: d.get("name") ?? "",
      category: d.get("category") ?? "",
      status: d.get("adoption_status") ?? "",
      gender: d.get("gender") ?? "",
      owner,
      photo: Array.isArray(media) && typeof media[0] === "string" ? media[0] : "",
      created: d.createTime?.toMillis() ?? 0,
    };
  });
  likes.docs.forEach((d) => engaged.add(rid(d.get("user_ref"))));
  chats.docs.forEach((d) => (d.get("participants") ?? []).forEach((r: unknown) => engaged.add(rid(r))));
  reqs.docs.forEach((d) => {
    engaged.add(rid(d.get("user_id")));
    engaged.add(rid(d.get("owner_id")));
  });
  posts.docs.forEach((d) => engaged.add(rid(d.get("user"))));
  engaged.delete("");
  return {
    pets: petRows,
    petCount,
    engaged,
    likes: likes.docs.map((d) => ms(d.get("created_at"))),
    chats: chats.docs.map((d) => ms(d.get("created_at"))),
    requests: reqs.docs.map((d) => ({ at: ms(d.get("requested_at")), status: d.get("status") ?? "" })),
    posts: posts.docs.map((d) => ms(d.get("created_at"))),
    chatCount: chats.size,
  };
});

export interface GeoUser {
  uid: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}
/** Only ~2% of users have a stored location; this is the set location filters operate on. */
export const loadGeoUsers = cached(async (): Promise<GeoUser[]> => {
  const s = await adminDb().collection("Users").where("location", "!=", null).select("display_name", "Address", "location").get();
  return s.docs.map((d) => ({
    uid: d.id,
    name: d.get("display_name") ?? "",
    address: d.get("Address") ?? "",
    lat: d.get("location")?.latitude ?? 0,
    lng: d.get("location")?.longitude ?? 0,
  }));
});

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
