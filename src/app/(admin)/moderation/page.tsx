"use client";

import { Eye, EyeOff, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { Suspense, useState } from "react";
import { Pagination, paginate } from "@/components/Pagination";
import { PersonLink, Thumb } from "@/components/people";
import { Badge, Chip, Empty, ErrorBox, PageHeader, Skeleton, btnDanger, btnGhost, btnPrimary } from "@/components/ui";
import { api, fmtMs } from "@/lib/api";
import type { Action, Item, Moderation, Tab } from "@/lib/moderationTypes";
import { invalidate, useApi } from "@/lib/query";
import { useUrlState } from "@/lib/urlstate";

const PATH = "/api/admin/moderation";
const TABS: { key: Tab; label: string; empty: string }[] = [
  { key: "review", label: "Needs review", empty: "Nothing is waiting for review." },
  { key: "hidden", label: "Hidden", empty: "Nothing is hidden." },
  { key: "done", label: "Reviewed", empty: "No reviewed reports yet." },
];
const DEFAULTS = { tab: "review", page: "1", size: "10" };

function Row({ item, onDone }: { item: Item; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const open = item.reports.filter((r) => r.status === "Pending" || r.status === "");

  async function act(action: Action) {
    setBusy(true);
    setError(null);
    try {
      await api(PATH, {
        method: "POST",
        body: JSON.stringify({ action, path: item.path, source: item.source, reportIds: open.map((r) => r.id) }),
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <li className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="accent">{item.type === "User" && item.source === "user" ? "Person (from chat)" : item.type}</Badge>
        {item.hidden && <Badge tone="danger">Hidden in the app</Badge>}
        {!item.exists && <Badge>Deleted</Badge>}
        {item.author && <span><span className="text-muted">{item.path ? "by" : "about"}</span> <PersonLink p={item.author} /></span>}
        <span className="ml-auto text-xs text-muted">{fmtMs(item.at)}</span>
      </div>

      {item.path && item.exists && (
        <div className="flex gap-3">
          {item.photo && <a href={item.photo} target="_blank" rel="noreferrer"><Thumb url={item.photo} size={64} /></a>}
          <div className="min-w-0">
            <p className="whitespace-pre-wrap break-words text-sm">{item.text || "(no text)"}</p>
            <Link href={`/posts/${item.postId}`} className="text-xs text-muted underline">Open post</Link>
          </div>
        </div>
      )}

      <ul className="space-y-1 border-t border-border pt-2 text-sm">
        {item.reports.map((r) => (
          <li key={r.id} className="flex flex-wrap gap-x-2">
            <span className="font-medium">{r.reason || "No reason given"}</span>
            <span className="text-muted">from <PersonLink p={r.reporter} /></span>
            {r.status !== "Pending" && r.status !== "" && <Badge>{r.status}</Badge>}
            {r.details && <span className="w-full break-words">{r.details}</span>}
          </li>
        ))}
        {item.olderReporters.length > 0 && (
          <li className="text-muted">
            Reported in an older app version by {item.olderReporters.map((p, i) => <span key={p.uid}>{i ? ", " : ""}<PersonLink p={p} /></span>)}
          </li>
        )}
        {item.reports.length === 0 && item.olderReporters.length === 0 && <li className="text-muted">No report on file.</li>}
      </ul>

      {error && <ErrorBox message={error} />}

      {item.exists && (
        <div className="flex flex-wrap gap-2">
          {item.path && (item.hidden
            ? <button className={btnPrimary} disabled={busy} onClick={() => act("keep")}><Eye className="h-4 w-4" />Show again</button>
            : item.tab === "review" && <button className={btnPrimary} disabled={busy} onClick={() => act("keep")}><Eye className="h-4 w-4" />Keep visible</button>)}
          {item.path && (!item.hidden || open.length > 0) && <button className={btnGhost} disabled={busy} onClick={() => act("hide")}><EyeOff className="h-4 w-4" />{item.hidden ? "Keep hidden" : "Hide"}</button>}
          {!item.path && open.length > 0 && <button className={btnPrimary} disabled={busy} onClick={() => act("dismiss")}>Mark resolved</button>}
          {item.path && (confirming ? (
            <>
              <button className={btnDanger} disabled={busy} onClick={() => act("delete")}>{busy ? "Deleting…" : "Yes, delete for good"}</button>
              <button className={btnGhost} disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
            </>
          ) : (
            <button className={btnGhost} disabled={busy} onClick={() => setConfirming(true)}><Trash2 className="h-4 w-4" />Delete</button>
          ))}
        </div>
      )}
      {!item.path && <p className="text-xs text-muted">Open the person to see their pets, posts and chats before deciding.</p>}
    </li>
  );
}

function Body() {
  const [u, set] = useUrlState(DEFAULTS);
  const { data, error, loading, reload } = useApi<Moderation>(PATH, 60_000);
  const tab = TABS.find((t) => t.key === u.tab) ?? TABS[0];
  const size = Number(u.size) || 10;
  const rows = data?.items.filter((i) => i.tab === tab.key) ?? [];
  const page = Math.min(Number(u.page) || 1, Math.max(1, Math.ceil(rows.length / size)));
  const refresh = () => { invalidate(PATH); reload(); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => <Chip key={t.key} active={tab.key === t.key} count={data?.counts[t.key]} onClick={() => set({ tab: t.key, page: "1" })}>{t.label}</Chip>)}
        <button className={`${btnGhost} ml-auto !px-2.5 !py-1.5 text-xs`} onClick={refresh}><RefreshCw className="h-3.5 w-3.5" />Refresh</button>
      </div>
      {error && <ErrorBox message={`Failed to load reports: ${error}`} onRetry={refresh} />}
      {!data && !error && (loading ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div> : null)}
      {data?.limited && <p className="text-xs text-muted">Only the newest 500 reports are shown.</p>}
      {data && (rows.length === 0 ? <Empty>{tab.empty}</Empty> : (
        <>
          <ul className="space-y-3">{paginate(rows, page, size).map((i) => <Row key={i.key} item={i} onDone={refresh} />)}</ul>
          <Pagination page={page} size={size} total={rows.length} onPage={(p) => set({ page: String(p) })} onSize={(s) => set({ size: String(s), page: "1" })} />
        </>
      ))}
    </div>
  );
}

export default function ModerationPage() {
  return (
    <>
      <PageHeader title="Moderation" sub="Reported and hidden posts, comments and people. Hidden content stays visible in older app versions." />
      <Suspense fallback={<Skeleton className="h-24" />}><Body /></Suspense>
    </>
  );
}
