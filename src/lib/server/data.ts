import { Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "./admin";
import { F, type GeoUser, type PetRow, type UserTuple } from "../shared";

// Day buckets use this offset from UTC (default IST +05:30).
export const TZ_MIN = Number(process.env.ADMIN_TZ_OFFSET_MIN ?? 330);
export const dayKey = (ms: number) => new Date(ms + TZ_MIN * 60_000).toISOString().slice(0, 10);

/** All Auth users as compact tuples. lastSeen = max(token refresh, sign-in, created). */
export async function fetchAuthUsers(): Promise<UserTuple[]> {
  const rows: UserTuple[] = [];
  let token: string | undefined;
  do {
    const page = await adminAuth().listUsers(1000, token);
    for (const u of page.users) {
      const created = Date.parse(u.metadata.creationTime) || 0;
      const signIn = Date.parse(u.metadata.lastSignInTime) || 0;
      const refresh = Date.parse(u.metadata.lastRefreshTime ?? "") || 0;
      const ids = u.providerData.map((p) => p.providerId);
      const method = ids.includes("apple.com") ? 0 : ids.includes("google.com") ? 1 : ids.includes("password") ? 2 : 3;
      rows.push([u.uid, u.email ?? "", u.displayName ?? "", created, Math.max(signIn, refresh, created), u.disabled ? 1 : 0, u.emailVerified ? F.VERIFIED : 0, method]);
    }
    token = page.pageToken;
  } while (token);
  return rows;
}

const ms = (t: unknown) => (t instanceof Timestamp ? t.toMillis() : 0);
const rid = (r: unknown) => (r && typeof r === "object" && "id" in r ? (r as DocumentReference).id : "");

export interface RawEngagement {
  pets: PetRow[];
  petCount: Map<string, number>;
  engaged: Set<string>;
  likedUsers: Set<string>;
  chattedUsers: Set<string>;
  requestedUsers: Set<string>;
  approvedUsers: Set<string>;
  likes: number[];
  chats: number[];
  requests: { at: number; status: string }[];
  posts: number[];
  postedUsers: Set<string>;
}

/** Small collections (a few hundred docs each) – read once per bundle build. */
export async function fetchEngagement(): Promise<RawEngagement> {
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
  const likedUsers = new Set<string>(), chattedUsers = new Set<string>(), requestedUsers = new Set<string>(), approvedUsers = new Set<string>();
  likes.docs.forEach((d) => likedUsers.add(rid(d.get("user_ref"))));
  chats.docs.forEach((d) => (d.get("participants") ?? []).forEach((r: unknown) => chattedUsers.add(rid(r))));
  reqs.docs.forEach((d) => {
    requestedUsers.add(rid(d.get("user_id")));
    if (d.get("status") === "Approved") approvedUsers.add(rid(d.get("user_id")));
    engaged.add(rid(d.get("user_id")));
    engaged.add(rid(d.get("owner_id")));
  });
  const postedUsers = new Set<string>();
  posts.docs.forEach((d) => { engaged.add(rid(d.get("user"))); postedUsers.add(rid(d.get("user"))); });
  postedUsers.delete("");
  [likedUsers, chattedUsers].forEach((s) => s.forEach((u) => engaged.add(u)));
  [engaged, likedUsers, chattedUsers, requestedUsers, approvedUsers].forEach((s) => s.delete(""));
  return {
    pets: petRows, petCount, engaged, likedUsers, chattedUsers, requestedUsers, approvedUsers,
    likes: likes.docs.map((d) => ms(d.get("created_at"))),
    chats: chats.docs.map((d) => ms(d.get("created_at"))),
    requests: reqs.docs.map((d) => ({ at: ms(d.get("requested_at")), status: d.get("status") ?? "" })),
    posts: posts.docs.map((d) => ms(d.get("created_at"))),
    postedUsers,
  };
}

/** Only ~2% of users have a stored location. */
export async function fetchGeoUsers(): Promise<GeoUser[]> {
  const s = await adminDb().collection("Users").where("location", "!=", null).select("display_name", "Address", "location").get();
  return s.docs.map((d) => ({
    uid: d.id,
    name: d.get("display_name") ?? "",
    address: d.get("Address") ?? "",
    lat: d.get("location")?.latitude ?? 0,
    lng: d.get("location")?.longitude ?? 0,
  }));
}


/** Profile / location / report flags per user, plus the name the app shows, from the Users documents (one read each). */
export async function fetchUserFlags(): Promise<{ flags: Map<string, number>; names: Map<string, string> }> {
  const s = await adminDb().collection("Users").select("display_name", "photo_url", "Gender", "FavoritePet", "location", "viewed_pet", "report_count").get();
  const m = new Map<string, number>();
  const names = new Map<string, string>();
  for (const d of s.docs) {
    const name = d.get("display_name");
    if (typeof name === "string" && name.trim()) names.set(d.id, name.trim());
    let f = 0;
    if (d.get("display_name")) f |= F.NAME;
    if (d.get("photo_url")) f |= F.PHOTO;
    if (d.get("Gender")) f |= F.GENDER;
    if (d.get("FavoritePet")) f |= F.FAV;
    if (d.get("location")) f |= F.LOC;
    if ((d.get("viewed_pet") ?? []).length) f |= F.VIEWED;
    if ((d.get("report_count") ?? 0) > 0) f |= F.REPORTED;
    m.set(d.id, f);
  }
  return { flags: m, names };
}

/** Users with a registered push device, and users who switched notifications off. */
export async function fetchReach(): Promise<{ push: Set<string>; notifOff: Set<string> }> {
  const db = adminDb();
  const [tokens, prefs] = await Promise.all([
    db.collectionGroup("fcm_tokens").select().get(),
    db.collectionGroup("Preferences").select("Notification").get(),
  ]);
  const push = new Set<string>(), notifOff = new Set<string>();
  tokens.docs.forEach((d) => { const u = d.ref.parent.parent?.id; if (u) push.add(u); });
  prefs.docs.forEach((d) => { if (d.get("Notification") === false) { const u = d.ref.parent.parent?.id; if (u) notifOff.add(u); } });
  return { push, notifOff };
}
