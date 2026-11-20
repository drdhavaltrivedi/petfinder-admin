import { DocumentReference, GeoPoint, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./admin";

/** Turn Firestore values into JSON-safe values: refs -> "Collection/id", timestamps -> ISO, geopoints -> "lat, lng". */
export function serialize(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (v instanceof DocumentReference) return v.path;
  if (v instanceof GeoPoint) return `${v.latitude}, ${v.longitude}`;
  if (Array.isArray(v)) return v.map(serialize);
  if (typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, serialize(x)]));
  return v;
}

export const flat = (d: Record<string, unknown> | undefined) => (d ? (serialize(d) as Record<string, unknown>) : {});

export const ms = (t: unknown): number | null =>
  t instanceof Timestamp ? t.toMillis() : t && typeof (t as { toMillis?: unknown }).toMillis === "function" ? (t as { toMillis(): number }).toMillis() : null;

export const refId = (r: unknown): string => (r && typeof r === "object" && "id" in r ? String((r as { id: unknown }).id) : "");

export interface PersonLite { uid: string; name: string; email: string; photo: string }

/** Batch-resolve user refs/uids to a small public summary. Missing users resolve to an empty entry. */
export async function people(ids: Iterable<string>): Promise<Map<string, PersonLite>> {
  const uniq = [...new Set([...ids].filter(Boolean))];
  const out = new Map<string, PersonLite>();
  if (!uniq.length) return out;
  const db = adminDb();
  for (let i = 0; i < uniq.length; i += 300) {
    const slice = uniq.slice(i, i + 300);
    const docs = await db.getAll(...slice.map((u) => db.doc(`Users/${u}`)), { fieldMask: ["display_name", "email", "photo_url"] });
    docs.forEach((d) => out.set(d.id, { uid: d.id, name: d.get("display_name") ?? "", email: d.get("email") ?? "", photo: d.get("photo_url") ?? "" }));
  }
  return out;
}
export const who = (m: Map<string, PersonLite>, uid: string): PersonLite => m.get(uid) ?? { uid, name: "", email: "", photo: "" };

/** Names of pets for a set of ids. */
export async function petNames(ids: Iterable<string>): Promise<Map<string, { name: string; category: string; photo: string }>> {
  const uniq = [...new Set([...ids].filter(Boolean))];
  const out = new Map<string, { name: string; category: string; photo: string }>();
  if (!uniq.length) return out;
  const db = adminDb();
  for (let i = 0; i < uniq.length; i += 300) {
    const docs = await db.getAll(...uniq.slice(i, i + 300).map((p) => db.doc(`Pets/${p}`)), { fieldMask: ["name", "category", "pet_medias"] });
    docs.forEach((d) => {
      const m = d.get("pet_medias");
      out.set(d.id, { name: d.get("name") ?? "", category: d.get("category") ?? "", photo: Array.isArray(m) && typeof m[0] === "string" ? m[0] : "" });
    });
  }
  return out;
}

export interface ChatSummary { id: string; petId: string; createdAt: number | null; updatedAt: number | null; participants: string[]; messages: number; last: { text: string; at: number | null; sender: string } | null }

/** Chat list entries (no message text beyond the one-line last message). */
export async function chatSummaries(docs: FirebaseFirestore.QueryDocumentSnapshot[], limit = 40): Promise<ChatSummary[]> {
  const list = docs.slice(0, limit);
  return Promise.all(list.map(async (d) => {
    const [count, last] = await Promise.all([
      d.ref.collection("Messages").count().get().then((s) => s.data().count).catch(() => 0),
      d.ref.collection("LastMessage").limit(1).get().then((s) => s.docs[0]).catch(() => undefined),
    ]);
    return {
      id: d.id,
      petId: refId(d.get("pet_ref")),
      createdAt: ms(d.get("created_at")),
      updatedAt: ms(d.get("updated_at")),
      participants: ((d.get("participants") ?? []) as unknown[]).map(refId),
      messages: count,
      last: last ? { text: String(last.get("text") ?? ""), at: ms(last.get("sent_at")), sender: refId(last.get("sender_ref")) } : null,
    };
  }));
}
