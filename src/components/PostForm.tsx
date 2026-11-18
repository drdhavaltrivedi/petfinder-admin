"use client";

import { useEffect, useMemo, useState } from "react";
import { OFFICIAL_AUTHOR_UID } from "@/lib/firebase";
import { CATEGORIES, type Category, type UserDoc } from "@/lib/models";
import { getUserById } from "@/lib/posts";
import { Avatar, ErrorBox, btnGhost, btnPrimary, input } from "./ui";
import Link from "next/link";

export const MAX_CAPTION = 2000;

interface Props {
  initial?: { caption: string; category: Category; photo_url: string };
  imageRequired: boolean;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (v: { caption: string; category: Category; file: File | null }) => Promise<void>;
  cancelHref: string;
}

export default function PostForm({ initial, imageRequired, submitLabel, busyLabel, onSubmit, cancelHref }: Props) {
  const [caption, setCaption] = useState(initial?.caption ?? "");
  const [category, setCategory] = useState<Category | "">(initial?.category ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [author, setAuthor] = useState<UserDoc | null>(null);
  const [authorErr, setAuthorErr] = useState(false);

  useEffect(() => {
    getUserById(OFFICIAL_AUTHOR_UID).then((u) => (u ? setAuthor(u) : setAuthorErr(true)));
  }, []);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : initial?.photo_url ?? ""), [file, initial]);
  useEffect(() => () => { if (file) URL.revokeObjectURL(preview); }, [file, preview]);

  const trimmed = caption.trim();
  const valid =
    trimmed.length > 0 && caption.length <= MAX_CAPTION && category !== "" && (!imageRequired || !!file);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy || !category) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ caption: trimmed, category, file });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={submit} className="space-y-5">
        <div className="flex items-center gap-3 rounded-lg bg-slate-100 p-3">
          <Avatar url={author?.photo_url} name={author?.display_name} />
          <div className="text-sm">
            <div className="text-slate-500">Posting as</div>
            <div className="font-semibold">
              {author?.display_name || (authorErr ? `Unknown author (${OFFICIAL_AUTHOR_UID})` : "…")}
            </div>
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Caption *</span>
          <textarea
            className={`${input} min-h-36`}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={MAX_CAPTION}
            required
          />
          <span className="block text-right text-xs text-slate-500">{caption.length}/{MAX_CAPTION}</span>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Category *</span>
          <select className={input} value={category} onChange={(e) => setCategory(e.target.value as Category)} required>
            <option value="" disabled>Select a category…</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Image {imageRequired ? "*" : "(leave empty to keep current)"}</span>
          <input
            type="file"
            accept="image/*"
            className={input}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <span className="block text-xs text-slate-500">Resized to max 1080×1080 and converted to JPEG before upload.</span>
        </label>

        {error && <ErrorBox message={error} />}
        <div className="flex gap-3">
          <button className={btnPrimary} disabled={!valid || busy}>{busy ? busyLabel : submitLabel}</button>
          <Link href={cancelHref} className={btnGhost}>Cancel</Link>
        </div>
      </form>

      <div>
        <div className="mb-2 text-sm font-medium text-slate-500">Preview</div>
        <article className="max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 p-3">
            <Avatar url={author?.photo_url} name={author?.display_name} />
            <span className="text-sm font-semibold">{author?.display_name ?? "Author"}</span>
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs">{category || "Category"}</span>
          </div>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="aspect-square w-full object-cover" />
          ) : (
            <div className="grid aspect-square place-items-center bg-slate-100 text-sm text-slate-400">No image</div>
          )}
          <p className="whitespace-pre-wrap break-words p-3 text-sm">{caption || "Your caption appears here…"}</p>
        </article>
      </div>
    </div>
  );
}
