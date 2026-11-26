"use client";

import { Flag, Heart, MessageCircle, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Pagination, paginate } from "@/components/Pagination";
import { Badge, Chip, Empty, ErrorBox, PageHeader, Skeleton, btnGhost, btnPrimary, fmtDate } from "@/components/ui";
import { CATEGORIES, type PostDoc, type UserDoc } from "@/lib/models";
import { describeError, listAllPosts, resolveAuthors } from "@/lib/posts";
import { useUrlState } from "@/lib/urlstate";

const DEFAULTS = { cat: "", reported: "", page: "1", size: "10" };

function Body() {
  const [u, set] = useUrlState(DEFAULTS);
  const [posts, setPosts] = useState<PostDoc[] | null>(null);
  const [authors, setAuthors] = useState<Record<string, UserDoc | null>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setError(null);
    try {
      const p = await listAllPosts(force);
      setPosts(p);
      setAuthors(await resolveAuthors(p.map((x) => x.user)));
    } catch (e) { setError(describeError("Failed to load posts", e)); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const byCat = useMemo(() => (posts ?? []).filter((p) => !u.reported || p.report_count > 0), [posts, u.reported]);
  const rows = byCat.filter((p) => !u.cat || p.category === u.cat);
  const size = Number(u.size) || 10;
  const reset = (patch: Partial<typeof DEFAULTS>) => set({ ...patch, page: "1" });

  if (error) return <ErrorBox message={error} onRetry={() => load(true)} />;
  if (!posts) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Chip active={!u.cat} count={byCat.length} onClick={() => reset({ cat: "" })}>All</Chip>
        {CATEGORIES.map((c) => <Chip key={c} active={u.cat === c} count={byCat.filter((p) => p.category === c).length} onClick={() => reset({ cat: c })}>{c}</Chip>)}
        <span className="mx-1 w-px bg-border" />
        <Chip active={!!u.reported} count={posts.filter((p) => p.report_count > 0).length} onClick={() => reset({ reported: u.reported ? "" : "1" })}><Flag className="h-3.5 w-3.5" />Reported</Chip>
      </div>

      {rows.length === 0 ? <Empty action={<Link href="/posts/new" className={btnPrimary}>Create a post</Link>}>No posts match.</Empty> : (
        <>
          <ul className="space-y-3">
            {paginate(rows, Number(u.page) || 1, size).map((p) => {
              const a = p.user ? authors[p.user.path] : null;
              const reported = p.report_count > 0;
              return (
                <li key={p.id}>
                  <Link href={`/posts/${p.id}`} className={`flex gap-4 rounded-xl border p-3 transition hover:shadow-md ${reported ? "border-danger/40 bg-danger/10" : "border-border bg-surface"}`}>
                    {p.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photo_url} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-lg bg-surface-2 object-cover" />
                    ) : (
                      <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-surface-2 text-xs text-muted">No photo</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 break-words text-sm">{p.caption}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <Badge>{p.category}</Badge>{p.hidden && <Badge tone="danger">Hidden</Badge>}<span>{a?.display_name ?? "Unknown author"}</span>
                        <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{p.likes_count}</span>
                        <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" />{p.comments_count}</span>
                        <span className={`inline-flex items-center gap-1 ${reported ? "font-semibold text-danger" : ""}`}><Flag className="h-3 w-3" />{p.report_count}</span>
                        <span>{fmtDate(p.created_at)}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Pagination page={Number(u.page) || 1} size={size} total={rows.length} onPage={(p) => set({ page: String(p) })} onSize={(s) => set({ size: String(s), page: "1" })} />
        </>
      )}
      <button className={btnGhost} onClick={() => load(true)}>Reload posts</button>
    </div>
  );
}

export default function PostsPage() {
  return (
    <>
      <PageHeader title="Posts" sub="Community posts" actions={<Link href="/posts/new" className={btnPrimary}><Plus className="h-4 w-4" />New post</Link>} />
      <Suspense fallback={<Skeleton className="h-24" />}><Body /></Suspense>
    </>
  );
}
