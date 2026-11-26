// Shared (client + server) shapes of the moderation queue.
import type { Person } from "./insightTypes";

export type ContentType = "Post" | "Comment" | "User" | "Message";
export type Tab = "review" | "hidden" | "done";
export type Action = "hide" | "keep" | "delete" | "dismiss";

export interface Report {
  id: string;
  reason: string;
  details: string;
  status: string;
  at: number | null;
  reporter: Person;
}

export interface Item {
  key: string;
  type: ContentType;
  /** Firestore path of the post or comment; empty for reports about a person or message. */
  path: string;
  /** "content" = ContentReports collection (1.2 app), "user" = Reports collection (chat reports). */
  source: "content" | "user";
  exists: boolean;
  hidden: boolean;
  tab: Tab;
  text: string;
  photo: string;
  postId: string;
  author: Person | null;
  reports: Report[];
  /** Reporters known only from the post itself (older app versions). */
  olderReporters: Person[];
  at: number | null;
}

export interface Moderation {
  items: Item[];
  counts: Record<Tab, number>;
  /** True when only the newest reports were read. */
  limited: boolean;
}
