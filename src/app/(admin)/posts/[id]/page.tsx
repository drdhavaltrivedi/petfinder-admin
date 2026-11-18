"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CommentDoc, PostDoc, UserDoc } from "@/lib/models";
import { deletePost, describeError, getPost, listComments, resolveAuthors } from "@/lib/posts";
import { Avatar, Empty, ErrorBox, Spinner, btnDanger, btnGhost, fmtDate } from "@/components/ui";

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<PostDoc | null | undefined>(undefined);
  const [comments, setComments] = useState<CommentDoc[] | null>(null);
  const [authors, setAuthors] = useState<Record<string, UserDoc | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [commentsErr, setCommentsErr] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await getPost(id);
        setPost(p);
        if (!p) return;
        const [c] = await Promise.all([
          listComments(id).catch((e) => {
            setCommentsErr(describeError("Failed to load comments", e));
            return [] as CommentDoc[];
          }),
        ]);
        setComments(c);
        setAuthors(await resolveAuthors([p.user, ...c.map((x) => x.user), ...p.reported_users]));
      } catch (e) {
        setError(describeError("Failed to load post", e));
      }
    })();
  }, [id]);

  async function doDelete() {
    setDeleting(true);
    setDeleteErr(null);
    try {
      await deletePost(id);
      router.replace("/posts");
    } catch (e) {
      setDeleteErr(describeError("Delete failed", e));
      setDeleting(false);
    }
  }

  if (error) return <ErrorBox message={error} />;
  if (post === undefined) return <Spinner />;
  if (post === null) return <Empty>Post not found. <Link className="underline" href="/posts">Back to posts</Link></Empty>;

  const author = post.user ? authors[post.user.path] : null;

  return (
    <div className="space-y-6">
      <Link href="/posts" className="text-sm text-muted hover:underline">← All posts</Link>

      <div className="grid gap-6 md:grid-cols-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={post.photo_url} alt="" className="w-full rounded-2xl bg-surface-2 object-cover" />
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Avatar url={author?.photo_url} name={author?.display_name} />
            <div>
              <div className="text-sm font-semibold">{author?.display_name ?? "Unknown author"}</div>
              <div className="text-xs text-muted">{fmtDate(post.created_at)}</div>
            </div>
            <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-xs">{post.category}</span>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm">{post.caption}</p>
          <dl className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-surface p-2 border border-border"><dt className="text-xs text-muted">Likes</dt><dd className="font-semibold">{post.likes_count}</dd></div>
            <div className="rounded-lg bg-surface p-2 border border-border"><dt className="text-xs text-muted">Comments</dt><dd className="font-semibold">{post.comments_count}</dd></div>
            <div className={`rounded-lg p-2 border ${post.report_count > 0 ? "border-danger/40 bg-danger/10 text-danger" : "border-border bg-surface"}`}><dt className="text-xs">Reports</dt><dd className="font-semibold">{post.report_count}</dd></div>
          </dl>
          {post.reported_users.length > 0 && (
            <p className="text-xs text-muted">
              Reported by: {post.reported_users.map((r) => authors[r.path]?.display_name ?? r.id).join(", ")}
            </p>
          )}
          <p className="text-xs text-muted">Updated {fmtDate(post.updated_at)}</p>

          {deleteErr && <ErrorBox message={deleteErr} />}
          <div className="flex gap-3">
            <Link href={`/posts/${id}/edit`} className={btnGhost}>Edit</Link>
            <button className={btnDanger} onClick={() => setConfirming(true)}>Delete</button>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Comments ({comments?.length ?? "…"})</h2>
        {commentsErr && <ErrorBox message={commentsErr} />}
        {comments === null && !commentsErr && <Spinner label="Loading comments…" />}
        {comments && comments.length === 0 && !commentsErr && <Empty>No comments.</Empty>}
        <ul className="space-y-2">
          {comments?.map((c) => {
            const u = c.user ? authors[c.user.path] : null;
            return (
              <li key={c.id} className="flex gap-3 rounded-lg border border-border bg-surface p-3">
                <Avatar url={u?.photo_url} name={u?.display_name} />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{u?.display_name ?? "Unknown user"} <span className="ml-2 text-xs font-normal text-muted">{fmtDate(c.created_at)}</span></div>
                  <p className="whitespace-pre-wrap break-words text-sm">{c.comment}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {confirming && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-surface p-5">
            <h3 className="font-semibold">Delete this post?</h3>
            <p className="text-sm text-muted">This permanently removes the post document. It cannot be undone.</p>
            {deleteErr && <ErrorBox message={deleteErr} />}
            <div className="flex justify-end gap-3">
              <button className={btnGhost} onClick={() => setConfirming(false)} disabled={deleting}>Cancel</button>
              <button className={btnDanger} onClick={doDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete post"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
