"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { CATEGORIES, type Category, type PostDoc, type UserDoc } from "@/lib/models";
import { describeError, listPosts, resolveAuthors } from "@/lib/posts";
import { Empty, ErrorBox, Spinner, btnGhost, btnPrimary, fmtDate, input } from "@/components/ui";

export default function PostsPage() {
  const [category, setCategory] = useState<Category | "all">("all");
  const [posts, setPosts] = useState<PostDoc[]>([]);
  const [authors, setAuthors] = useState<Record<string, UserDoc | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const last = useRef<QueryDocumentSnapshot | undefined>(undefined);
  const reqId = useRef(0);

  const load = useCallback(
    async (reset: boolean) => {
      const id = ++reqId.current;
      setLoading(true);
      setError(null);
      try {
        const r = await listPosts(category, reset ? undefined : last.current);
        const a = await resolveAuthors(r.posts.map((p) => p.user));
        if (id !== reqId.current) return;
        last.current = r.last;
        setPosts((prev) => (reset ? r.posts : [...prev, ...r.posts]));
        setAuthors((prev) => ({ ...prev, ...a }));
        setHasMore(r.hasMore);
      } catch (e) {
        if (id === reqId.current) {
          if (reset) setPosts([]);
          setError(describeError("Failed to load posts", e));
        }
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [category],
  );

  useEffect(() => {
    last.current = undefined;
    // Fetch-on-mount/filter-change: load() sets loading state before awaiting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(true);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Posts</h1>
        <select className={`${input} !w-auto`} value={category} onChange={(e) => setCategory(e.target.value as Category | "all")} aria-label="Filter by category">
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <Link href="/posts/new" className={`${btnPrimary} ml-auto`}>+ New post</Link>
      </div>

      {error && <ErrorBox message={error} onRetry={() => load(posts.length === 0)} />}

      {!error && !loading && posts.length === 0 && <Empty>No posts{category !== "all" ? ` in “${category}”` : ""} yet.</Empty>}

      <ul className="space-y-3">
        {posts.map((p) => {
          const a = p.user ? authors[p.user.path] : null;
          const reported = p.report_count > 0;
          return (
            <li key={p.id}>
              <Link
                href={`/posts/${p.id}`}
                className={`flex gap-4 rounded-xl border bg-white p-3 transition hover:shadow-md ${reported ? "border-red-300 bg-red-50" : "border-slate-200"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.photo_url} alt="" className="h-20 w-20 shrink-0 rounded-lg bg-slate-200 object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words text-sm">{p.caption}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{p.category}</span>
                    <span>{a?.display_name ?? "Unknown author"}</span>
                    <span>♥ {p.likes_count}</span>
                    <span>💬 {p.comments_count}</span>
                    <span className={reported ? "font-semibold text-red-700" : ""}>⚑ {p.report_count}</span>
                    <span>{fmtDate(p.created_at)}</span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {loading && <Spinner label="Loading posts…" />}
      {!loading && hasMore && !error && (
        <div className="text-center">
          <button className={btnGhost} onClick={() => load(false)}>Load more</button>
        </div>
      )}
    </div>
  );
}
