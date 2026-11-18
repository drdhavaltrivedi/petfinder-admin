import { FieldValue } from "firebase-admin/firestore";
import { HttpError, adminDb, adminMessaging, handle, requireAdmin } from "@/lib/server/admin";

const ms = (t: unknown) => (t && typeof (t as { toMillis?: unknown }).toMillis === "function" ? (t as { toMillis(): number }).toMillis() : null);

/** Recent adoption requests + chats so the admin can see existing connections. */
export const GET = handle(async (req) => {
  await requireAdmin(req);
  const db = adminDb();
  const [reqs, chats] = await Promise.all([
    db.collection("AdoptionRequests").orderBy("requested_at", "desc").limit(30).get(),
    db.collection("Chats").orderBy("created_at", "desc").limit(30).get(),
  ]);
  const uids = new Set<string>();
  reqs.docs.forEach((d) => { uids.add(d.get("user_id")?.id); uids.add(d.get("owner_id")?.id); });
  chats.docs.forEach((d) => (d.get("participants") ?? []).forEach((r: { id: string }) => uids.add(r.id)));
  uids.delete(undefined as unknown as string);
  const list = [...uids];
  const docs = list.length ? await db.getAll(...list.map((u) => db.doc(`Users/${u}`)), { fieldMask: ["display_name", "email"] }) : [];
  const name = new Map(docs.map((d) => [d.id, d.get("display_name") || d.get("email") || d.id]));
  return {
    adoptionRequests: reqs.docs.map((d) => ({
      id: d.id,
      status: d.get("status"),
      at: ms(d.get("requested_at")),
      from: name.get(d.get("user_id")?.id) ?? "",
      owner: name.get(d.get("owner_id")?.id) ?? "",
      petId: d.get("pet_id")?.id ?? "",
    })),
    chats: chats.docs.map((d) => ({
      id: d.id,
      at: ms(d.get("created_at")),
      petId: d.get("pet_ref")?.id ?? "",
      people: (d.get("participants") ?? []).map((r: { id: string }) => name.get(r.id) ?? r.id),
    })),
  };
});

/**
 * Create a connection between two users about a pet: a Chats doc (same shape the app writes),
 * a first message from the official author, then an FCM push to both users' devices.
 */
export const POST = handle(async (req) => {
  const admin = await requireAdmin(req);
  const b = (await req.json().catch(() => null)) as { userA?: string; userB?: string; petId?: string; message?: string } | null;
  const userA = b?.userA?.trim(), userB = b?.userB?.trim(), petId = b?.petId?.trim();
  const message = (b?.message ?? "").trim().slice(0, 500) || "You have been connected by the PetFinder team. Say hello!";
  if (!userA || !userB || !petId) throw new HttpError(400, "userA, userB and petId are required.");
  if (userA === userB) throw new HttpError(400, "Choose two different users.");

  const db = adminDb();
  const author = process.env.NEXT_PUBLIC_OFFICIAL_AUTHOR_UID || admin.uid;
  const refA = db.doc(`Users/${userA}`), refB = db.doc(`Users/${userB}`), petRef = db.doc(`Pets/${petId}`);
  const [a, bDoc, pet] = await db.getAll(refA, refB, petRef);
  if (!a.exists) throw new HttpError(404, `User ${userA} not found.`);
  if (!bDoc.exists) throw new HttpError(404, `User ${userB} not found.`);
  if (!pet.exists) throw new HttpError(404, `Pet ${petId} not found.`);

  const existing = await db.collection("Chats").where("participants", "array-contains", refA).get();
  const dup = existing.docs.find(
    (d) => d.get("pet_ref")?.id === petId && (d.get("participants") as { id: string }[]).some((r) => r.id === userB),
  );
  if (dup) throw new HttpError(409, "These users already have a chat about this pet.", { chatId: dup.id });

  const chatRef = db.collection("Chats").doc();
  const sender = db.doc(`Users/${author}`);
  const batch = db.batch();
  batch.set(chatRef, { pet_ref: petRef, participants: [refA, refB], created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp() });
  batch.set(chatRef.collection("Messages").doc(), { sender_ref: sender, receiver_ref: refB, text: message, type: "Text", read: false, image_url: "", timestamp: FieldValue.serverTimestamp() });
  batch.set(chatRef.collection("LastMessage").doc(), { sender_ref: sender, text: message, type: "Text", sent_at: FieldValue.serverTimestamp() });
  await batch.commit();

  // Push to every device of both users (best effort; the chat already exists either way).
  const tokenSnaps = await Promise.all([userA, userB].map((u) => db.collection(`Users/${u}/fcm_tokens`).get()));
  const tokens = [...new Set(tokenSnaps.flatMap((s) => s.docs.map((d) => d.get("fcm_token") as string).filter(Boolean)))];
  let sent = 0, failed = 0;
  if (tokens.length) {
    const petName = pet.get("name") ?? "a pet";
    const res = await adminMessaging().sendEachForMulticast({
      tokens,
      notification: { title: "New connection on PetFinder", body: `You've been connected about ${petName}. Open the app to chat.` },
    });
    sent = res.successCount;
    failed = res.failureCount;
  }
  return { chatId: chatRef.id, push: { devices: tokens.length, sent, failed } };
});
