import { FieldValue, type DocumentSnapshot, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb, HttpError } from "./admin";
import { ms, people, refId, who } from "./serialize";
import type { Action, ContentType, Item, Moderation, Report, Tab } from "../moderationTypes";
import type { Person } from "../insightTypes";

const LIMIT = 500;
const POST = /^Post\/[^/]+$/;
const COMMENT = /^Post\/[^/]+\/Comments\/[^/]+$/;

const pathOf = (r: unknown): string =>
  r && typeof r === "object" && "path" in r ? String((r as { path: unknown }).path) : "";
const isOpen = (status: string) => status === "" || status === "Pending";

interface Raw { id: string; source: "content" | "user"; type: ContentType; path: string; target: string; data: FirebaseFirestore.DocumentData }

function rawFrom(d: QueryDocumentSnapshot, source: "content" | "user"): Raw {
  const data = d.data();
  if (source === "user") return { id: d.id, source, type: "User", path: "", target: refId(data.reported_ref), data };
  const type = (["Post", "Comment", "User", "Message"].includes(data.content_type) ? data.content_type : "User") as ContentType;
  const path = type === "Post" ? pathOf(data.post_ref) : type === "Comment" ? pathOf(data.comment_ref) : "";
  const valid = (type === "Post" && POST.test(path)) || (type === "Comment" && COMMENT.test(path));
  return { id: d.id, source, type, path: valid ? path : "", target: refId(data.reported_user), data };
}

/** Everything that was reported or hidden, grouped by what it is about. */
export async function listModeration(): Promise<Moderation> {
  const db = adminDb();
  const [content, users, hiddenPosts, reportedPosts] = await Promise.all([
    db.collection("ContentReports").orderBy("created_at", "desc").limit(LIMIT).get(),
    db.collection("Reports").limit(LIMIT).get(),
    db.collection("Post").where("hidden", "==", true).limit(LIMIT).get(),
    db.collection("Post").where("report_count", ">", 0).limit(LIMIT).get(),
  ]);

  const groups = new Map<string, Raw[]>();
  const add = (r: Raw) => {
    // Reports about a post or comment are reviewed together; others one by one.
    const key = r.path || `${r.source}:${r.id}`;
    const list = groups.get(key);
    if (list) list.push(r); else groups.set(key, [r]);
  };
  content.docs.forEach((d) => add(rawFrom(d, "content")));
  users.docs.forEach((d) => add(rawFrom(d, "user")));
  [...hiddenPosts.docs, ...reportedPosts.docs].forEach((d) => { if (!groups.has(d.ref.path)) groups.set(d.ref.path, []); });

  const paths = [...groups.keys()].filter((k) => POST.test(k) || COMMENT.test(k));
  const snaps = new Map<string, DocumentSnapshot>();
  for (let i = 0; i < paths.length; i += 300) {
    const found = await db.getAll(...paths.slice(i, i + 300).map((p) => db.doc(p)));
    found.forEach((s) => snaps.set(s.ref.path, s));
  }

  const ids = new Set<string>();
  groups.forEach((list, key) => {
    list.forEach((r) => { ids.add(refId(r.data.reporter_ref)); ids.add(r.target); });
    const doc = snaps.get(key);
    if (doc?.exists) {
      ids.add(refId(doc.get("user")));
      const older = doc.get("reported_users");
      if (Array.isArray(older)) older.forEach((u) => ids.add(refId(u)));
    }
  });
  const P = await people(ids);
  const person = (uid: string): Person | null => (uid ? who(P, uid) : null);

  const items: Item[] = [...groups].map(([key, list]) => {
    const onContent = POST.test(key) || COMMENT.test(key);
    const doc = onContent ? snaps.get(key) : undefined;
    const data = doc?.data();
    const first = list[0];
    const type: ContentType = first?.type ?? "Post";
    const reports: Report[] = list.map((r) => ({
      id: r.id,
      reason: String(r.data.reason ?? ""),
      details: String(r.data.description ?? ""),
      status: String(r.data.status ?? "Pending"),
      at: ms(r.data.created_at),
      reporter: who(P, refId(r.data.reporter_ref)),
    }));
    const known = new Set(list.map((r) => refId(r.data.reporter_ref)));
    const older = Array.isArray(data?.reported_users)
      ? data.reported_users.map(refId).filter((u: string) => u && !known.has(u))
      : [];
    const hidden = data?.hidden === true;
    const exists = onContent ? !!doc?.exists : true;
    const pending = reports.some((r) => isOpen(r.status));
    // Reports from older app versions live only on the post, until an admin decides.
    const undecided = older.length > 0 && !data?.moderation_status;
    const tab: Tab = !exists ? "done" : pending || undecided ? "review" : hidden ? "hidden" : "done";
    return {
      key,
      type,
      path: onContent ? key : "",
      source: first?.source ?? "content",
      exists,
      hidden,
      tab,
      text: String(data?.caption ?? data?.comment ?? ""),
      photo: String(data?.photo_url ?? ""),
      postId: onContent ? key.split("/")[1] : "",
      author: onContent ? person(refId(data?.user)) : person(first?.target ?? ""),
      reports: reports.sort((a, b) => (b.at ?? 0) - (a.at ?? 0)),
      olderReporters: older.map((u: string) => who(P, u)),
      at: Math.max(0, ...reports.map((r) => r.at ?? 0)) || ms(data?.hidden_at) || ms(data?.created_at),
    };
  });
  items.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  const counts: Record<Tab, number> = { review: 0, hidden: 0, done: 0 };
  items.forEach((i) => counts[i.tab]++);
  return { items, counts, limited: content.size === LIMIT || users.size === LIMIT };
}

export interface Decision { action: Action; path: string; source: "content" | "user"; reportIds: string[] }

export function parseDecision(body: unknown): Decision {
  const b = (body ?? {}) as Record<string, unknown>;
  const action = b.action as Action;
  if (!["hide", "keep", "delete", "dismiss"].includes(action)) throw new HttpError(400, "Unknown action.");
  const path = typeof b.path === "string" ? b.path : "";
  if (path && !POST.test(path) && !COMMENT.test(path)) throw new HttpError(400, "Only posts and comments can be changed.");
  if (action !== "dismiss" && !path) throw new HttpError(400, "This action needs a post or comment.");
  const source = b.source === "user" ? "user" : "content";
  const reportIds = Array.isArray(b.reportIds) ? b.reportIds : [];
  if (reportIds.length > 400 || reportIds.some((id) => typeof id !== "string" || !/^[^/]{1,200}$/.test(id)))
    throw new HttpError(400, "Invalid report list.");
  if (action === "dismiss" && !reportIds.length) throw new HttpError(400, "No report to close.");
  return { action, path, source, reportIds: reportIds as string[] };
}

/**
 * Applies an admin's decision and closes the reports it answers.
 * hide: hidden in the app. keep: visible and never auto-hidden again.
 * delete: removed (server cleanup removes what belongs to it). dismiss: close reports only.
 */
export async function decide(d: Decision, adminUid: string): Promise<{ ok: true }> {
  const db = adminDb();
  const collection = d.source === "user" ? "Reports" : "ContentReports";
  const refs = d.reportIds.map((id) => db.doc(`${collection}/${id}`));
  const found = refs.length ? await db.getAll(...refs) : [];
  const batch = db.batch();
  if (d.path) {
    const ref = db.doc(d.path);
    const snap = await ref.get();
    if (!snap.exists && d.action !== "delete") throw new HttpError(404, "This content no longer exists.");
    if (d.action === "hide")
      batch.update(ref, { hidden: true, hidden_at: FieldValue.serverTimestamp(), hidden_reason: "admin", moderation_status: "hidden" });
    // hidden_at stays set, which tells the server not to hide it automatically again.
    if (d.action === "keep") batch.update(ref, { hidden: false, moderation_status: "approved" });
    if (d.action === "delete" && snap.exists) batch.delete(ref);
  }
  const status = d.action === "delete" || d.action === "dismiss" ? "Resolved" : "Reviewed";
  found.filter((r) => r.exists).forEach((r) => batch.update(r.ref, { status }));
  await batch.commit();
  console.info("moderation", JSON.stringify({ admin: adminUid, action: d.action, path: d.path, reports: d.reportIds.length }));
  return { ok: true };
}
