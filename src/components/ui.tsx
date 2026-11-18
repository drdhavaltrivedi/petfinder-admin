import type { ReactNode } from "react";

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 justify-center text-sm text-slate-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 break-words" role="alert">
      {message}
      {onRetry && (
        <button onClick={onRetry} className="ml-3 underline font-medium">
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">{children}</div>;
}

export const btn =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
export const btnPrimary = `${btn} bg-slate-900 text-white hover:bg-slate-700`;
export const btnGhost = `${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50`;
export const btnDanger = `${btn} bg-red-600 text-white hover:bg-red-500`;
export const input =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900";

export function fmtDate(t: { toDate(): Date } | null) {
  return t ? t.toDate().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
}

export function Avatar({ url, name }: { url?: string; name?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" className="h-8 w-8 rounded-full object-cover" /> : (
    <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}
