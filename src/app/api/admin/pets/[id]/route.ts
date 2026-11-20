import { HttpError, adminDb, handle, requireAdmin } from "@/lib/server/admin";
import { chatSummaries, flat, ms, people, refId, who } from "@/lib/server/serialize";

type Ctx = { params: Promise<{ id: string }> };

/** Everything we know about one pet: raw fields, owner, breed, likes, adoption requests and chats. */
export const GET = handle(async (req, ctx: unknown) => {
  await requireAdmin(req);
  const { id } = await (ctx as Ctx).params;
  const db = adminDb();
  const ref = db.doc(`Pets/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Pet not found.");
  const d = snap.data() ?? {};

  const ownerId = refId(d.owner_ref);
  const [breed, likes, reqs, chats] = await Promise.all([
    d.breed_ref ? (d.breed_ref as FirebaseFirestore.DocumentReference).get().catch(() => null) : Promise.resolve(null),
    db.collection("Likes").where("pet_ref", "==", ref).get(),
    db.collection("AdoptionRequests").where("pet_id", "==", ref).get(),
    db.collection("Chats").where("pet_ref", "==", ref).get(),
  ]);
  const chatList = await chatSummaries(chats.docs);
  const ids = new Set<string>([ownerId]);
  likes.docs.forEach((x) => ids.add(refId(x.get("user_ref"))));
  reqs.docs.forEach((x) => { ids.add(refId(x.get("user_id"))); ids.add(refId(x.get("owner_id"))); });
  chatList.forEach((c) => c.participants.forEach((p) => ids.add(p)));
  const P = await people(ids);

  return {
    id,
    created: snap.createTime?.toMillis() ?? null,
    updated: snap.updateTime?.toMillis() ?? null,
    raw: flat(d),
    name: d.name ?? "",
    category: d.category ?? "",
    gender: d.gender ?? "",
    status: d.adoption_status ?? "",
    bio: d.bio ?? "",
    height: d.height ?? "",
    weight: d.weight ?? "",
    birthDate: ms(d.birth_date),
    adoptionDate: ms(d.adoption_date),
    qualities: Array.isArray(d.qualities) ? d.qualities : [],
    media: Array.isArray(d.pet_medias) ? d.pet_medias.filter((x: unknown) => typeof x === "string") : [],
    owner: who(P, ownerId),
    breed: breed?.exists ? { id: breed.id, name: breed.get("name") ?? "", type: breed.get("type") ?? "", description: breed.get("description") ?? "", temperament: breed.get("temperament") ?? [] } : null,
    likes: likes.docs.map((x) => ({ at: ms(x.get("created_at")), user: who(P, refId(x.get("user_ref"))) })).sort((a, b) => (b.at ?? 0) - (a.at ?? 0)),
    requests: reqs.docs.map((x) => ({
      id: x.id, status: x.get("status") ?? "", message: x.get("message") ?? "", at: ms(x.get("requested_at")),
      from: who(P, refId(x.get("user_id"))), owner: who(P, refId(x.get("owner_id"))),
    })).sort((a, b) => (b.at ?? 0) - (a.at ?? 0)),
    chats: chatList.map((c) => ({ ...c, people: c.participants.map((p) => who(P, p)), last: c.last ? { ...c.last, senderName: who(P, c.last.sender).name || who(P, c.last.sender).email } : null })),
  };
});
