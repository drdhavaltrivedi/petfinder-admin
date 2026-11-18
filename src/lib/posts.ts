import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type DocumentReference,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { auth, db, OFFICIAL_AUTHOR_UID, storage } from "./firebase";
import { compressImage } from "./image";
import {
  commentConverter,
  postConverter,
  userConverter,
  type Category,
  type CommentDoc,
  type PostDoc,
  type UserDoc,
} from "./models";

export const PAGE_SIZE = 20;

export function describeError(action: string, e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  const msg = (e as { message?: string })?.message ?? String(e);
  if (code === "permission-denied" || code === "storage/unauthorized")
    return `${action}: permission denied. The Firestore/Storage rules (managed in FlutterFlow) do not allow this action for the signed-in admin.`;
  if (code === "failed-precondition" && /index/i.test(msg))
    return `${action}: a Firestore composite index is required. Open the link in this message to create it: ${msg}`;
  if (code === "unavailable") return `${action}: network unavailable. Check your connection.`;
  return `${action}: ${msg}`;
}

// ---- Users ----
const userCache = new Map<string, Promise<UserDoc | null>>();
export function getUser(r: DocumentReference | null): Promise<UserDoc | null> {
  if (!r) return Promise.resolve(null);
  let p = userCache.get(r.path);
  if (!p) {
    p = getDoc(r.withConverter(userConverter))
      .then((s) => (s.exists() ? s.data() : null))
      .catch(() => {
        userCache.delete(r.path);
        return null;
      });
    userCache.set(r.path, p);
  }
  return p;
}
export const getUserById = (uid: string) => getUser(doc(db, "Users", uid));

export async function resolveAuthors(refs: (DocumentReference | null)[]) {
  const out: Record<string, UserDoc | null> = {};
  await Promise.all(
    refs.map(async (r) => {
      if (r) out[r.path] = await getUser(r);
    }),
  );
  return out;
}

// ---- Posts ----
export async function listPosts(category: Category | "all", after?: QueryDocumentSnapshot) {
  const c: QueryConstraint[] = [];
  if (category !== "all") c.push(where("category", "==", category));
  c.push(orderBy("created_at", "desc"));
  if (after) c.push(startAfter(after));
  c.push(limit(PAGE_SIZE));
  const snap = await getDocs(query(collection(db, "Post").withConverter(postConverter), ...c));
  return {
    posts: snap.docs.map((d) => d.data()),
    last: snap.docs.length ? snap.docs[snap.docs.length - 1] : undefined,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}

// All posts are loaded once (the collection is small) and filtered/paged in the browser.
let postsCache: { at: number; data: PostDoc[] } | null = null;
export const invalidatePosts = () => { postsCache = null; };
export async function listAllPosts(force = false): Promise<PostDoc[]> {
  if (!force && postsCache && Date.now() - postsCache.at < 10 * 60_000) return postsCache.data;
  const snap = await getDocs(query(collection(db, "Post").withConverter(postConverter), orderBy("created_at", "desc"), limit(500)));
  const data = snap.docs.map((d) => d.data());
  postsCache = { at: Date.now(), data };
  return data;
}

export async function getPost(id: string): Promise<PostDoc | null> {
  const s = await getDoc(doc(db, "Post", id).withConverter(postConverter));
  return s.exists() ? s.data() : null;
}

export async function listComments(postId: string): Promise<CommentDoc[]> {
  const snap = await getDocs(
    query(
      collection(db, "Post", postId, "Comments").withConverter(commentConverter),
      orderBy("created_at", "asc"),
    ),
  );
  return snap.docs.map((d) => d.data());
}

/** Compress to <=1080px JPEG and upload to users/{uid}/uploads/{Date.now()}.jpg */
export async function uploadPostImage(file: File): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in.");
  const blob = await compressImage(file);
  const r = storageRef(storage, `users/${uid}/uploads/${Date.now()}.jpg`);
  await uploadBytes(r, blob, { contentType: "image/jpeg" });
  return getDownloadURL(r);
}

export interface PostInput {
  caption: string;
  category: Category;
}

export async function createPost(input: PostInput, photoUrl: string) {
  if (!OFFICIAL_AUTHOR_UID) throw new Error("NEXT_PUBLIC_OFFICIAL_AUTHOR_UID is not set.");
  invalidatePosts();
  return addDoc(collection(db, "Post"), {
    caption: input.caption,
    photo_url: photoUrl,
    category: input.category,
    user: doc(db, "Users", OFFICIAL_AUTHOR_UID),
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    likes_count: 0,
    comments_count: 0,
    report_count: 0,
    reported_users: [],
  });
}

/** Counters, author and created_at are deliberately NOT written here. */
export async function updatePost(id: string, input: PostInput, photoUrl?: string) {
  invalidatePosts();
  await updateDoc(doc(db, "Post", id), {
    caption: input.caption,
    category: input.category,
    ...(photoUrl ? { photo_url: photoUrl } : {}),
    updated_at: serverTimestamp(),
  });
}

export const deletePost = (id: string) => { invalidatePosts(); return deleteDoc(doc(db, "Post", id)); };
