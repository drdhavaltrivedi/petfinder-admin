"use client";

import { useState } from "react";

const show = (v: unknown): string => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** Collapsible table of every stored field of a document (nothing hidden, nothing guessed). */
export function RawFields({ data, title = "All stored fields" }: { data: Record<string, unknown>; title?: string }) {
  const [open, setOpen] = useState(false);
  const rows = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  return (
    <section className="rounded-xl border border-border bg-surface">
      <button className="flex w-full items-center justify-between p-4 text-left text-sm font-semibold" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{title} ({rows.length})</span><span className="text-xs font-normal text-muted">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <dl className="divide-y divide-border border-t border-border text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="grid gap-1 px-4 py-2 sm:grid-cols-[200px_1fr]"><dt className="font-mono text-xs text-muted">{k}</dt><dd className="break-words">{show(v)}</dd></div>
          ))}
        </dl>
      )}
    </section>
  );
}
