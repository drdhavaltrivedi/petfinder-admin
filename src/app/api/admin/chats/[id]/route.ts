import { HttpError, adminDb, handle, requireAdmin } from "@/lib/server/admin";
import { ms, people, refId, who } from "@/lib/server/serialize";

type Ctx = { params: Promise<{ id: string }> };
const MAX = 500;

/** One chat with its messages. Admin-only; every view is written to the server log for accountability. */
export const GET = handle(async (req, ctx: unknown) => {
  const admin = await requireAdmin(req);
  const { id } = await (ctx as Ctx).params;
  const db = adminDb();
  const chat = await db.doc(`Chats/${id}`).get();
  if (!chat.exists) throw new HttpError(404, "Chat not found.");
  console.log(`admin chat view: ${admin.uid} opened chat ${id}`);

  const msgs = await chat.ref.collection("Messages").orderBy("timestamp", "asc").limit(MAX + 1).get();
  const truncated = msgs.size > MAX;
  const parts = ((chat.get("participants") ?? []) as unknown[]).map(refId);
  const P = await people([...parts, ...msgs.docs.map((m) => refId(m.get("sender_ref")))]);
  const petRef = chat.get("pet_ref") as FirebaseFirestore.DocumentReference | undefined;
  const pet = petRef ? await petRef.get().catch(() => null) : null;

  return {
    id,
    createdAt: ms(chat.get("created_at")),
    updatedAt: ms(chat.get("updated_at")),
    pet: pet?.exists ? { id: pet.id, name: pet.get("name") ?? "", category: pet.get("category") ?? "" } : petRef ? { id: petRef.id, name: "", category: "" } : null,
    participants: parts.map((p) => who(P, p)),
    truncated,
    messages: msgs.docs.slice(0, MAX).map((m) => ({
      id: m.id, at: ms(m.get("timestamp")), type: m.get("type") ?? "Text", text: m.get("text") ?? "", image: m.get("image_url") ?? "",
      read: !!m.get("read"), sender: who(P, refId(m.get("sender_ref"))),
    })),
  };
});
