import { HttpError, adminAuth, adminDb, handle, requireAdmin } from "@/lib/server/admin";
import { chatSummaries, flat, ms, people, petNames, refId, who } from "@/lib/server/serialize";

type Ctx = { params: Promise<{ uid: string }> };

const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 5 * 60_000;

export const GET = handle(async (req, ctx: unknown) => {
  await requireAdmin(req);
  const { uid } = await (ctx as Ctx).params;
  const hit = cache.get(uid);
  if (hit && Date.now() - hit.at < TTL && !new URL(req.url).searchParams.has("fresh")) return hit.data;
  const data = await load(uid);
  cache.set(uid, { at: Date.now(), data });
  return data;
});

/** Never fail the whole profile because one optional section failed (missing index, bad data…). */
const soft = async <T,>(p: Promise<T>, fallback: T): Promise<T> => p.catch(() => fallback);

async function load(uid: string) {
  const db = adminDb();
  const ref = db.doc(`Users/${uid}`);
  const [authUser, doc] = await Promise.all([adminAuth().getUser(uid).catch(() => null), ref.get()]);
  if (!authUser && !doc.exists) throw new HttpError(404, "User not found.");

  const [pets, sent, received, likesGiven, chats, tokens, prefs, blocksMade, blocksReceived, reportsAgainst, reportsFiled, notifs, posts, saved] = await Promise.all([
    db.collection("Pets").where("owner_ref", "==", ref).get(),
    db.collection("AdoptionRequests").where("user_id", "==", ref).get(),
    db.collection("AdoptionRequests").where("owner_id", "==", ref).get(),
    db.collection("Likes").where("user_ref", "==", ref).get(),
    db.collection("Chats").where("participants", "array-contains", ref).get(),
    ref.collection("fcm_tokens").get(),
    soft(ref.collection("Preferences").limit(1).get(), null),
    soft(db.collection("UserBlocks").where("blocker_ref", "==", ref).get(), null),
    soft(db.collection("UserBlocks").where("blocked_ref", "==", ref).get(), null),
    soft(db.collection("Reports").where("reported_ref", "==", ref).get(), null),
    soft(db.collection("Reports").where("reporter_ref", "==", ref).get(), null),
    soft(db.collection("Notifications").where("user_ref", "==", ref).orderBy("created_at", "desc").limit(20).get(), null),
    soft(db.collection("Post").where("user", "==", ref).get(), null),
    soft(ref.collection("SavePosts").count().get().then((s) => s.data().count), 0),
  ]);

  const chatList = await chatSummaries(chats.docs.sort((a, b) => (ms(b.get("updated_at")) ?? 0) - (ms(a.get("updated_at")) ?? 0)));
  const likedPetIds = likesGiven.docs.map((d) => refId(d.get("pet_ref"))).filter(Boolean);
  const petIdsNeeded = new Set<string>([...likedPetIds, ...sent.docs.map((d) => refId(d.get("pet_id"))), ...received.docs.map((d) => refId(d.get("pet_id"))), ...chatList.map((c) => c.petId)]);
  const ppl = new Set<string>();
  sent.docs.forEach((d) => ppl.add(refId(d.get("owner_id")))); received.docs.forEach((d) => ppl.add(refId(d.get("user_id"))));
  chatList.forEach((c) => c.participants.forEach((p) => ppl.add(p)));
  [blocksMade, blocksReceived].forEach((s, i) => s?.docs.forEach((d) => ppl.add(refId(d.get(i === 0 ? "blocked_ref" : "blocker_ref")))));
  reportsAgainst?.docs.forEach((d) => ppl.add(refId(d.get("reporter_ref")))); reportsFiled?.docs.forEach((d) => ppl.add(refId(d.get("reported_ref"))));
  const [P, PN] = await Promise.all([people(ppl), petNames(petIdsNeeded)]);
  const pn = (id: string) => ({ id, ...(PN.get(id) ?? { name: "", category: "", photo: "" }) });

  const loc = doc.get("location");
  const prefDoc = prefs?.docs[0];
  return {
    uid,
    email: authUser?.email ?? doc.get("email") ?? "",
    name: doc.get("display_name") || authUser?.displayName || "",
    photo: doc.get("photo_url") ?? "",
    phone: doc.get("phone_number") ?? "",
    address: doc.get("Address") ?? "",
    gender: doc.get("Gender") ?? "",
    favoritePet: doc.get("FavoritePet") ?? "",
    isOwner: !!doc.get("is_owner"),
    viewedPets: Array.isArray(doc.get("viewed_pet")) ? doc.get("viewed_pet").length : 0,
    location: loc ? { lat: loc.latitude, lng: loc.longitude } : null,
    created: authUser ? Date.parse(authUser.metadata.creationTime) : ms(doc.get("created_time")),
    lastSignIn: authUser ? Date.parse(authUser.metadata.lastSignInTime) || null : null,
    lastRefresh: authUser?.metadata.lastRefreshTime ? Date.parse(authUser.metadata.lastRefreshTime) : null,
    disabled: authUser?.disabled ?? false,
    emailVerified: authUser?.emailVerified ?? false,
    providers: authUser?.providerData.map((p) => p.providerId) ?? [],
    reportCount: doc.get("report_count") ?? 0,
    counts: { likes: likesGiven.size, chats: chats.size, pushTokens: tokens.size, posts: posts?.size ?? 0, savedPosts: saved, viewedPets: Array.isArray(doc.get("viewed_pet")) ? doc.get("viewed_pet").length : 0 },
    devices: tokens.docs.map((t) => ({ type: String(t.get("device_type") ?? ""), at: ms(t.get("created_at")) })),
    preferences: prefDoc ? flat(prefDoc.data()) : null,
    raw: flat(doc.data()),
    pets: pets.docs.map((d) => {
      const m = d.get("pet_medias");
      return { id: d.id, name: d.get("name") ?? "", category: d.get("category") ?? "", gender: d.get("gender") ?? "", status: d.get("adoption_status") ?? "", photo: Array.isArray(m) ? m[0] ?? "" : "", created: d.createTime?.toMillis() ?? null };
    }),
    adoptionRequests: [
      ...sent.docs.map((d) => ({ id: d.id, direction: "sent", status: d.get("status"), at: ms(d.get("requested_at")), message: d.get("message") ?? "", pet: pn(refId(d.get("pet_id"))), other: who(P, refId(d.get("owner_id"))) })),
      ...received.docs.map((d) => ({ id: d.id, direction: "received", status: d.get("status"), at: ms(d.get("requested_at")), message: d.get("message") ?? "", pet: pn(refId(d.get("pet_id"))), other: who(P, refId(d.get("user_id"))) })),
    ].sort((a, b) => (b.at ?? 0) - (a.at ?? 0)),
    likedPets: likesGiven.docs.filter((d) => d.get("pet_ref")).map((d) => ({ at: ms(d.get("created_at")), pet: pn(refId(d.get("pet_ref"))) })).sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, 50),
    chats: chatList.map((c) => ({ ...c, pet: pn(c.petId), people: c.participants.filter((p) => p !== uid).map((p) => who(P, p)) })),
    blocks: { made: (blocksMade?.docs ?? []).map((d) => ({ at: ms(d.get("created_at")), user: who(P, refId(d.get("blocked_ref"))) })), received: (blocksReceived?.docs ?? []).map((d) => ({ at: ms(d.get("created_at")), user: who(P, refId(d.get("blocker_ref"))) })) },
    reports: {
      against: (reportsAgainst?.docs ?? []).map((d) => ({ id: d.id, at: ms(d.get("created_at")), status: d.get("status") ?? "", reason: d.get("reason") ?? "", description: d.get("description") ?? "", by: who(P, refId(d.get("reporter_ref"))) })),
      filed: (reportsFiled?.docs ?? []).map((d) => ({ id: d.id, at: ms(d.get("created_at")), status: d.get("status") ?? "", reason: d.get("reason") ?? "", description: d.get("description") ?? "", against: who(P, refId(d.get("reported_ref"))) })),
    },
    notifications: (notifs?.docs ?? []).map((d) => ({ id: d.id, at: ms(d.get("created_at")), type: d.get("type") ?? "", title: d.get("title") ?? "", body: d.get("body") ?? "", read: !!d.get("read") })),
    posts: (posts?.docs ?? []).map((d) => ({ id: d.id, at: ms(d.get("created_at")), category: d.get("category") ?? "", caption: d.get("caption") ?? "", photo: d.get("photo_url") ?? "", likes: d.get("likes_count") ?? 0, comments: d.get("comments_count") ?? 0, reports: d.get("report_count") ?? 0 })).sort((a, b) => (b.at ?? 0) - (a.at ?? 0)),
  };
}
