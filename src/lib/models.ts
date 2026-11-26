import {
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  type SnapshotOptions,
} from "firebase/firestore";

export const CATEGORIES = ["Story", "Adoption", "Advice", "Photo", "Events"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface UserDoc {
  id: string;
  display_name: string;
  photo_url: string;
  email: string;
  uid: string;
}

export interface PostDoc {
  id: string;
  caption: string;
  photo_url: string;
  category: Category;
  user: DocumentReference | null;
  created_at: Timestamp | null;
  updated_at: Timestamp | null;
  likes_count: number;
  comments_count: number;
  report_count: number;
  reported_users: DocumentReference[];
  hidden: boolean;
}

export interface CommentDoc {
  id: string;
  user: DocumentReference | null;
  comment: string;
  created_at: Timestamp | null;
  postid: DocumentReference | null;
  parent_ref: DocumentReference | null;
  hidden: boolean;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const ts = (v: unknown) => (v instanceof Timestamp ? v : null);
const ref = (v: unknown) =>
  v && typeof v === "object" && "path" in v && "firestore" in v ? (v as DocumentReference) : null;

type Snap = QueryDocumentSnapshot<DocumentData>;

// Read-only converters: all writes are built explicitly in src/lib/posts.ts so that
// edits never touch the counters and creates use serverTimestamp().
export const userConverter: FirestoreDataConverter<UserDoc, DocumentData> = {
  toFirestore: (u) => ({
    display_name: u.display_name,
    photo_url: u.photo_url,
    email: u.email,
    uid: u.uid,
  }),
  fromFirestore(s: Snap, o?: SnapshotOptions): UserDoc {
    const d = s.data(o);
    return {
      id: s.id,
      display_name: str(d.display_name),
      photo_url: str(d.photo_url),
      email: str(d.email),
      uid: str(d.uid) || s.id,
    };
  },
};

export const postConverter: FirestoreDataConverter<PostDoc, DocumentData> = {
  toFirestore: (p) => {
    const { id: _id, ...rest } = p;
    void _id;
    return rest;
  },
  fromFirestore(s: Snap, o?: SnapshotOptions): PostDoc {
    const d = s.data(o);
    const cat = CATEGORIES.find((c) => c === d.category);
    return {
      id: s.id,
      caption: str(d.caption),
      photo_url: str(d.photo_url),
      category: cat ?? ("Story" as Category),
      user: ref(d.user),
      created_at: ts(d.created_at),
      updated_at: ts(d.updated_at),
      likes_count: num(d.likes_count),
      comments_count: num(d.comments_count),
      report_count: num(d.report_count),
      reported_users: Array.isArray(d.reported_users)
        ? d.reported_users.map(ref).filter((r): r is DocumentReference => r !== null)
        : [],
      hidden: d.hidden === true,
    };
  },
};

export const commentConverter: FirestoreDataConverter<CommentDoc, DocumentData> = {
  toFirestore: (c) => {
    const { id: _id, ...rest } = c;
    void _id;
    return rest;
  },
  fromFirestore(s: Snap, o?: SnapshotOptions): CommentDoc {
    const d = s.data(o);
    return {
      id: s.id,
      user: ref(d.user),
      comment: str(d.comment),
      created_at: ts(d.created_at),
      postid: ref(d.postid),
      parent_ref: ref(d.parent_ref),
      hidden: d.hidden === true,
    };
  },
};
