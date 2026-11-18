"use client";

import { AlertCircle, Inbox, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger break-words" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && <button onClick={onRetry} className="shrink-0 font-medium underline">Retry</button>}
    </div>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
      <Inbox className="h-6 w-6" />
      <div>{children}</div>
      {action}
    </div>
  );
}

export const btn =
  "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
export const btnPrimary = `${btn} bg-accent text-accent-fg hover:opacity-90`;
export const btnGhost = `${btn} border border-border bg-surface hover:bg-surface-2`;
export const btnDanger = `${btn} bg-danger text-white hover:opacity-90`;
export const input =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-muted focus:border-accent";

export function fmtDate(t: { toDate(): Date } | null) {
  return t ? t.toDate().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
}

export function Avatar({ url, name, size = 32 }: { url?: string; name?: string; size?: number }) {
  const s = { width: size, height: size };
  if (url)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" style={s} className="shrink-0 rounded-full bg-surface-2 object-cover" />;
  const label = (name || "?").trim();
  let h = 0;
  for (const c of label) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span style={{ ...s, background: `hsl(${h} 55% 45%)`, fontSize: size * 0.4 }} className="grid shrink-0 place-items-center rounded-full font-semibold text-white">
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" | "danger" | "success" | "accent" }) {
  const t = {
    neutral: "bg-surface-2 text-muted",
    warn: "bg-warn/15 text-warn",
    danger: "bg-danger/15 text-danger",
    success: "bg-success/15 text-success",
    accent: "bg-accent/15 text-accent",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}

export function PageHeader({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <div className="min-w-0 flex-1 font-semibold">{title}</div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-2" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  );
}

export function Chip({ active, onClick, children, count }: { active?: boolean; onClick: () => void; children: ReactNode; count?: number }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
        active ? "border-accent bg-accent/10 font-medium text-accent" : "border-border bg-surface hover:bg-surface-2"
      }`}
    >
      {children}
      {count !== undefined && <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? "bg-accent/20" : "bg-surface-2 text-muted"}`}>{count.toLocaleString()}</span>}
    </button>
  );
}
