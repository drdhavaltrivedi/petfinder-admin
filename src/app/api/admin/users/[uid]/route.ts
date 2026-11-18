import { HttpError, adminAuth, adminDb, handle, requireAdmin } from "@/lib/server/admin";

type Ctx = { params: Promise<{ uid: string }> };
const iso = (t: unknown) => (t && typeof (t as { toMillis?: unknown }).toMillis === "function" ? (t as { toMillis(): number }).toMillis() : null);

export const GET = handle(async (req, ctx: unknown) => {
  await requireAdmin(req);
  const { uid } = await (ctx as Ctx).params;
  const db = adminDb();
  const ref = db.doc(`Users/${uid}`);
  const [authUser, doc] = await Promise.all([
    adminAuth().getUser(uid).catch(() => null),
    ref.get(),
  ]);
  if (!authUser && !doc.exists) throw new HttpError(404, "User not found.");

  const [pets, sent, received, likes, chats, tokens] = await Promise.all([
    db.collection("Pets").where("owner_ref", "==", ref).get(),
    db.collection("AdoptionRequests").where("user_id", "==", ref).get(),
    db.collection("AdoptionRequests").where("owner_id", "==", ref).get(),
    db.collection("Likes").where("user_ref", "==", ref).count().get(),
    db.collection("Chats").where("participants", "array-contains", ref).count().get(),
    ref.collection("fcm_tokens").count().get(),
  ]);

  return {
    uid,
    email: authUser?.email ?? doc.get("email") ?? "",
    name: doc.get("display_name") || authUser?.displayName || "",
    photo: doc.get("photo_url") ?? "",
    address: doc.get("Address") ?? "",
    gender: doc.get("Gender") ?? "",
    favoritePet: doc.get("FavoritePet") ?? "",
    location: doc.get("location") ? { lat: doc.get("location").latitude, lng: doc.get("location").longitude } : null,
    created: authUser ? Date.parse(authUser.metadata.creationTime) : iso(doc.get("created_time")),
    lastSignIn: authUser ? Date.parse(authUser.metadata.lastSignInTime) || null : null,
    lastRefresh: authUser?.metadata.lastRefreshTime ? Date.parse(authUser.metadata.lastRefreshTime) : null,
    disabled: authUser?.disabled ?? false,
    providers: authUser?.providerData.map((p) => p.providerId) ?? [],
    reportCount: doc.get("report_count") ?? 0,
    counts: { likes: likes.data().count, chats: chats.data().count, pushTokens: tokens.data().count },
    pets: pets.docs.map((d) => ({
      id: d.id,
      name: d.get("name") ?? "",
      category: d.get("category") ?? "",
      status: d.get("adoption_status") ?? "",
      photo: (d.get("pet_medias") ?? [])[0] ?? "",
    })),
    adoptionRequests: [
      ...sent.docs.map((d) => ({ id: d.id, direction: "sent", status: d.get("status"), at: iso(d.get("requested_at")), petId: d.get("pet_id")?.id ?? "" })),
      ...received.docs.map((d) => ({ id: d.id, direction: "received", status: d.get("status"), at: iso(d.get("requested_at")), petId: d.get("pet_id")?.id ?? "" })),
    ],
  };
});
