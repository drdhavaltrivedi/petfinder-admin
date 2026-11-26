"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { None, PersonLink, Thumb } from "@/components/people";
import { Card, Stat } from "@/components/charts";
import { Badge, ErrorBox, PageHeader, Skeleton, btnGhost } from "@/components/ui";
import { fmtDay, fmtMs } from "@/lib/api";
import { GROUPS, type Insights, type Stage } from "@/lib/insightTypes";
import { useApi } from "@/lib/query";

const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "—");
const rel = (ms: number) => { const m = Math.round((Date.now() - ms) / 60_000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };

/** Plain-language things to act on, derived from the numbers below. */
function findings(d: Insights): { tone: "danger" | "warn" | "success"; title: string; body: string; href?: string }[] {
  const out: { tone: "danger" | "warn" | "success"; title: string; body: string; href?: string }[] = [];
  const S = (k: string) => d.stages.find((s) => s.key === k) as Stage;
  const signup = S("signup"), complete = S("complete"), viewed = S("viewed");
  out.push({ tone: "danger", title: `Only ${pct(complete.overall, signup.overall)} finish their profile`, body: `${complete.overall.toLocaleString()} of ${signup.overall.toLocaleString()} accounts. Everyone must finish the profile before seeing any pet, and only ${viewed.overall.toLocaleString()} (${pct(viewed.overall, signup.overall)}) ever viewed one. Making the profile optional is the biggest single fix.` });
  const a = signup.by.apple, g = signup.by.google;
  if (a > 200 && complete.by.apple / a < 0.01 && complete.by.google / Math.max(1, g) > 0.03)
    out.push({ tone: "danger", title: "Apple sign-in users are almost all stuck", body: `${complete.by.apple} of ${a.toLocaleString()} Apple users finished the profile (Google: ${pct(complete.by.google, g)}). Apple gives no profile photo and the app requires one: ${S("photo").by.apple} of ${a.toLocaleString()} have a photo.` });
  const under1h = d.timeToLeave[0].count;
  out.push({ tone: "warn", title: `${pct(under1h, d.totals.users)} are last seen within an hour of signing up`, body: "They leave in the first session. Retention numbers below are approximate (last sign-in or token refresh)." });
  const pend = d.supply.pendingAge, old = pend.d3to7 + pend.d7to14 + pend.over14d;
  const pendTotal = d.supply.requestsByStatus.Pending ?? 0;
  if (pendTotal) out.push({ tone: "warn", title: `${pendTotal} adoption requests are waiting, ${old} for over 3 days`, body: "Owners are not answering. Consider a reminder push or an auto-expire rule.", href: "#supply" });
  const open = d.moderation.reportsByStatus.Pending ?? 0;
  if (open) out.push({ tone: "danger", title: `${open} user report${open > 1 ? "s" : ""} not reviewed`, body: "Open the moderation queue below and review the people and content reported.", href: "#moderation" });
  if (d.supply.petsWithNoLikes > 0) out.push({ tone: "warn", title: `${d.supply.petsWithNoLikes} of ${Object.values(d.supply.petsByStatus).reduce((x, y) => x + y, 0)} pets have no likes`, body: "Supply is small and demand is thin. More (and better) listings are needed before features will keep people." });
  return out;
}

function Stages({ d }: { d: Insights }) {
  const tot = d.totals.byGroup;
  return (
    <Card title="1 · Where users drop off" note="Each cell is the share of that sign-in group that reached the step. Red = under 5% (a wall).">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm tabular-nums">
          <thead className="text-xs text-muted"><tr className="[&>th]:pb-2 [&>th]:font-medium"><th className="text-left">Step</th><th>All</th>{GROUPS.slice(0, 3).map((g) => <th key={g.key}>{g.label} <span className="font-normal">({tot[g.key].toLocaleString()})</span></th>)}</tr></thead>
          <tbody>
            {d.stages.map((s) => (
              <tr key={s.key} className="border-t border-border">
                <td className="py-1.5 text-left">{s.label}</td>
                <td><span className="font-medium">{s.overall.toLocaleString()}</span> <span className="text-muted">· {pct(s.overall, d.totals.users)}</span></td>
                {GROUPS.slice(0, 3).map((g) => { const r = tot[g.key] ? s.by[g.key] / tot[g.key] : 1; return <td key={g.key} className={r < 0.05 ? "font-medium text-danger" : ""}>{s.by[g.key].toLocaleString()} <span className="opacity-70">· {pct(s.by[g.key], tot[g.key])}</span></td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="mb-2 mt-6 text-xs font-medium text-muted">How long accounts lasted after signup (last seen − signup)</h3>
      <ul className="space-y-2">{d.timeToLeave.map((b) => <li key={b.label}><div className="flex justify-between text-sm"><span>{b.label}</span><span className="tabular-nums text-muted">{b.count.toLocaleString()} · {pct(b.count, d.totals.users)}</span></div><div className="mt-1 h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full bg-accent" style={{ width: `${(b.count / Math.max(1, ...d.timeToLeave.map((x) => x.count))) * 100}%` }} /></div></li>)}</ul>
    </Card>
  );
}

function Retention({ d }: { d: Insights }) {
  const cell = (v: number | null, early: boolean) =>
    v === null ? <td className="text-muted">—</td>
      : early ? <td className="italic text-muted" title="Too early to compare: this will still rise.">{v}% ↑</td>
        : <td className={v < 5 ? "text-danger" : ""}>{v}%</td>;
  return (
    <Card title="2 · Retention by signup week" note="Share of each week's new users still seen N days after signing up. Only the latest sign-in or token refresh is stored, so a figure keeps rising for weeks. Grey figures with ↑ are too recent to compare with older weeks; compare only the others. “—” means too few users or too recent to measure.">
      <div className="overflow-x-auto"><table className="w-full text-right text-sm tabular-nums">
        <thead className="text-xs text-muted"><tr className="[&>th]:pb-2 [&>th]:font-medium"><th className="text-left">Week starting</th><th>New users</th><th>Day 1</th><th>Day 7</th><th>Day 30</th></tr></thead>
        <tbody>{d.retention.map((r) => <tr key={r.week} className="border-t border-border"><td className="py-1.5 text-left text-muted">{r.week}</td><td>{r.users.toLocaleString()}</td>{cell(r.d1, r.early.d1)}{cell(r.d7, r.early.d7)}{cell(r.d30, r.early.d30)}</tr>)}</tbody>
      </table></div>
    </Card>
  );
}

function Supply({ d }: { d: Insights }) {
  const s = d.supply, p = s.pendingAge;
  const total = Object.values(s.petsByStatus).reduce((a, b) => a + b, 0);
  return (
    <div id="supply" className="space-y-4">
      <h2 className="text-lg font-semibold">3 · Supply and demand</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Pets listed" value={total} hint={`${s.petsByStatus.Active ?? 0} active`} />
        <Stat label="Pets with no likes" value={s.petsWithNoLikes} hint={pct(s.petsWithNoLikes, total)} tone={s.petsWithNoLikes > total / 2 ? "warn" : undefined} />
        <Stat label="Requests pending" value={s.requestsByStatus.Pending ?? 0} tone={(s.requestsByStatus.Pending ?? 0) > 0 ? "warn" : undefined} />
        <Stat label="Approved / rejected" value={`${s.requestsByStatus.Approved ?? 0} / ${s.requestsByStatus.Rejected ?? 0}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Pets by owner's country" note="Country comes from the owner's saved address; most owners have not shared one.">
          <ul className="space-y-1.5 text-sm">{s.petsByCountry.map((c) => <li key={c.country} className="flex justify-between"><span>{c.country}</span><span className="tabular-nums text-muted">{c.pets} pets · {c.users} owners</span></li>)}</ul>
        </Card>
        <Card title="Unanswered adoption requests (age)">
          <ul className="space-y-1.5 text-sm">{([["Under 3 days", p.under3d], ["3 – 7 days", p.d3to7], ["7 – 14 days", p.d7to14], ["Over 14 days", p.over14d]] as const).map(([l, n]) => <li key={l} className="flex justify-between"><span>{l}</span><span className="tabular-nums">{n}</span></li>)}</ul>
          <h3 className="mb-1 mt-4 text-xs font-medium text-muted">Owners with the most requests waiting</h3>
          {s.unanswered.length === 0 ? <None>Nothing waiting.</None> : <ul className="divide-y divide-border text-sm">{s.unanswered.map((u) => <li key={u.uid} className="flex items-center justify-between gap-2 py-1.5"><Link href={`/users/${u.uid}`} className="truncate hover:underline">{u.name || u.email || u.uid}</Link><span className="shrink-0 tabular-nums text-muted">{u.pending} waiting · oldest {u.oldestDays}d</span></li>)}</ul>}
        </Card>
        <Card title="Most liked pets (demand)">
          {s.topLiked.length === 0 ? <None /> : <ul className="divide-y divide-border text-sm">{s.topLiked.map((p) => <li key={p.id} className="flex justify-between py-1.5"><Link href={`/pets/${p.id}`} className="hover:underline">{p.name || "(unnamed)"} <span className="text-xs capitalize text-muted">{p.category}</span></Link><span className="tabular-nums text-muted">{p.likes} likes · {p.requests} requests</span></li>)}</ul>}
        </Card>
        <Card title="New pets per week">
          <ul className="space-y-1.5 text-sm">{s.petsPerWeek.map((w) => <li key={w.week} className="flex justify-between"><span className="text-muted">{w.week}</span><span className="tabular-nums">{w.count}</span></li>)}</ul>
          <h3 className="mb-1 mt-4 text-xs font-medium text-muted">By type</h3>
          <p className="flex flex-wrap gap-1.5">{Object.entries(s.petsByCategory).map(([k, v]) => <Badge key={k}>{k}: {v}</Badge>)}</p>
        </Card>
      </div>
    </div>
  );
}

function Moderation({ d }: { d: Insights }) {
  const m = d.moderation;
  return (
    <div id="moderation" className="space-y-4">
      <h2 className="text-lg font-semibold">4 · Moderation queue</h2>
      <Card title={`Reports waiting for review (${m.reports.length})`} note="Open the reported person to see their pets, posts, chats and other reports.">
        {m.reports.length === 0 ? <None>No pending reports.</None> : <ul className="divide-y divide-border text-sm">{m.reports.map((r) => <li key={r.id} className="space-y-0.5 py-2"><div className="flex flex-wrap justify-between gap-2"><span><PersonLink p={r.reported} /> <span className="text-muted">reported by</span> <PersonLink p={r.reporter} /></span><span className="text-xs text-muted">{fmtMs(r.at)}</span></div><div className="text-xs text-muted">{r.reason}</div>{r.description && <p>{r.description}</p>}</li>)}</ul>}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Pets listed in the last 7 days (${m.recentPets.length})`} note="Review new listings for anything that should not be there.">
          {m.recentPets.length === 0 ? <None /> : <ul className="divide-y divide-border text-sm">{m.recentPets.map((p) => <li key={p.id} className="flex items-center gap-3 py-2"><Thumb url={p.photo} size={40} /><div className="min-w-0 flex-1"><Link href={`/pets/${p.id}`} className="font-medium hover:underline">{p.name || "(unnamed)"}</Link> <span className="text-xs capitalize text-muted">{p.category}</span><div className="truncate text-xs text-muted"><PersonLink p={p.owner} /> · {fmtDay(p.at)}</div></div></li>)}</ul>}
        </Card>
        <Card title={`Latest community posts (${m.recentPosts.length})`}>
          {m.recentPosts.length === 0 ? <None /> : <ul className="divide-y divide-border text-sm">{m.recentPosts.map((p) => <li key={p.id} className="flex gap-3 py-2"><Thumb url={p.photo} size={40} /><div className="min-w-0"><div className="text-xs text-muted"><PersonLink p={p.author} /> · {fmtDay(p.at)}{p.reports ? ` · ${p.reports} reports` : ""}</div><p className="line-clamp-2">{p.caption}</p></div></li>)}</ul>}
        </Card>
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const [exclude, setExclude] = useState(true);
  const { data: d, error, loading, reload } = useApi<Insights>(`/api/admin/insights?excludeTest=${exclude ? 1 : 0}`, 30 * 60_000);
  return (
    <>
      <PageHeader
        title="Insights"
        sub="What to look at and what to do. Numbers are computed live from the app's data."
        actions={<>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={exclude} onChange={(e) => setExclude(e.target.checked)} />Hide Brilworks test accounts{d ? ` (${d.testAccounts})` : ""}</label>
          {d && <span className="text-xs text-muted">Updated {rel(d.generatedAt)}</span>}
          <button className={`${btnGhost} !px-2.5 !py-1.5 text-xs`} onClick={reload}><RefreshCw className="h-3.5 w-3.5" />Refresh (~40s)</button>
        </>}
      />
      {error && <ErrorBox message={`Failed to build insights: ${error}`} onRetry={reload} />}
      {!d && !error && <div className="space-y-4"><Skeleton className="h-28" /><Skeleton className="h-72" /><p className="text-center text-sm text-muted">{loading ? "Reading all users and activity… this takes about 40 seconds the first time." : ""}</p></div>}
      {d && (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">What to act on</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {findings(d).map((f) => (
                <div key={f.title} className={`rounded-xl border p-4 ${f.tone === "danger" ? "border-danger/40 bg-danger/10" : f.tone === "warn" ? "border-warn/40 bg-warn/10" : "border-success/40 bg-success/10"}`}>
                  <div className="font-medium">{f.href ? <a href={f.href} className="hover:underline">{f.title}</a> : f.title}</div>
                  <p className="mt-1 text-sm text-muted">{f.body}</p>
                </div>
              ))}
            </div>
          </section>
          <Stages d={d} />
          <Retention d={d} />
          <Supply d={d} />
          <Moderation d={d} />
        </div>
      )}
    </>
  );
}
