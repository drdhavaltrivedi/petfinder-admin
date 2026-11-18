"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { BUNDLE_TTL, useBundle } from "@/lib/bundle";
import { btnGhost } from "./ui";
import { useToast } from "./toast";

const rel = (ms: number) => {
  const m = Math.round(ms / 60_000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

export function DataStatus() {
  const { bundle, refreshing, refresh } = useBundle();
  const toast = useToast();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  if (!bundle) return null;
  const left = Math.max(0, BUNDLE_TTL - (now - bundle.generatedAt));
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span title={`Cached in this browser for 48h. Auto-refreshes in ${Math.round(left / 3_600_000)}h.`}>Data updated {rel(now - bundle.generatedAt)}</span>
      <button
        className={`${btnGhost} !px-2.5 !py-1.5 text-xs`}
        disabled={refreshing}
        onClick={async () => { await refresh(); toast("ok", "Data refreshed."); }}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />{refreshing ? "Refreshing (~30s)…" : "Refresh"}
      </button>
    </div>
  );
}

export function BundleGate({ children }: { children: (b: NonNullable<ReturnType<typeof useBundle>["bundle"]>) => React.ReactNode }) {
  const { bundle, loading, error, refresh } = useBundle();
  if (bundle) return <>{children(bundle)}</>;
  return (
    <div className="mx-auto max-w-md space-y-3 py-20 text-center">
      {error ? (
        <>
          <p className="text-sm text-danger">{error}</p>
          <button className={btnGhost} onClick={refresh}>Retry</button>
        </>
      ) : (
        <>
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
          <p className="font-medium">{loading ? "Building your dashboard…" : "Loading…"}</p>
          <p className="text-sm text-muted">The first load reads every user and takes about 30 seconds. After that it is cached in this browser for 48 hours, so browsing is instant.</p>
        </>
      )}
    </div>
  );
}
