"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useState } from "react";

export const PAGE_SIZES = [10, 25, 50, 100];

export function Pagination({ page, size, total, onPage, onSize }: {
  page: number; size: number; total: number; onPage: (p: number) => void; onSize: (s: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  const cur = Math.min(page, pages);
  const [typed, setTyped] = useState<string | null>(null); // null = show the real page number
  const draft = typed ?? String(cur);
  const from = total ? (cur - 1) * size + 1 : 0;
  const to = Math.min(total, cur * size);
  const go = (p: number) => onPage(Math.min(pages, Math.max(1, p)));
  const b = "grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-surface";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="text-muted tabular-nums">Showing {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}</div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-muted">
          Rows
          <select value={size} onChange={(e) => onSize(Number(e.target.value))} className="rounded-lg border border-border bg-surface px-2 py-1.5 text-fg">
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button className={b} disabled={cur <= 1} onClick={() => go(1)} aria-label="First page"><ChevronsLeft className="h-4 w-4" /></button>
          <button className={b} disabled={cur <= 1} onClick={() => go(cur - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
          <span className="flex items-center gap-1 px-1 text-muted">
            Page
            <input
              value={draft}
              inputMode="numeric"
              aria-label="Page number"
              onChange={(e) => setTyped(e.target.value.replace(/\D/g, ""))}
              onBlur={() => { go(Number(draft) || cur); setTyped(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { go(Number(draft) || cur); setTyped(null); } }}
              className="w-14 rounded-lg border border-border bg-surface px-2 py-1 text-center text-fg tabular-nums"
            />
            of {pages.toLocaleString()}
          </span>
          <button className={b} disabled={cur >= pages} onClick={() => go(cur + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
          <button className={b} disabled={cur >= pages} onClick={() => go(pages)} aria-label="Last page"><ChevronsRight className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

/** Slice helper + clamped page for client-side paging. */
export function paginate<T>(rows: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const cur = Math.min(Math.max(1, page), pages);
  return rows.slice((cur - 1) * size, cur * size);
}
