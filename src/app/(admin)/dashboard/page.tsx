"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bars, Card, Stat } from "@/components/charts";
import { ErrorBox, Spinner, btnGhost } from "@/components/ui";
import { api, fmtMs } from "@/lib/api";

interface Stats {
  generatedAt: number;
  timezoneOffsetMin: number;
  totals: { users: number; pets: number; activePets: number; likes: number; chats: number; posts: number; adoptionRequests: Record<string, number>; reportsPending: number; usersWithPushToken: number };
  signups: { today: number; last7: number; last30: number; series: { date: string; count: number }[] };
  activeUsers: { last1: number; last7: number; last30: number };
  inactive: { neverEngaged: number; notSeen30d: number; neverReturned: number };
  activity: { date: string; newUsers: number; petsListed: number; likes: number; chats: number; requests: number; posts: number }[];
  petsByCategory: Record<string, number>;
  petsByStatus: Record<string, number>;
  topListers: { uid: string; count: number; email: string; name: string }[];
}

const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "—");

export default function DashboardPage() {
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      setS(await api<Stats>(`/api/admin/stats${refresh ? "?refresh=1" : ""}`));
    } catch (e) {
      setError(`Failed to load dashboard: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  if (!s) return error ? <ErrorBox message={error} onRetry={() => load()} /> : <Spinner label="Loading dashboard (first load can take ~30s)…" />;
  const t = s.totals;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <span className="text-xs text-slate-500">Updated {fmtMs(s.generatedAt)}</span>
        <button className={`${btnGhost} ml-auto`} onClick={() => load(true)} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </div>
      {error && <ErrorBox message={error} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total users" value={t.users} />
        <Stat label="New today" value={s.signups.today} />
        <Stat label="New last 7 days" value={s.signups.last7} />
        <Stat label="New last 30 days" value={s.signups.last30} />
        <Stat label="Active last 24h" value={s.activeUsers.last1} hint={pct(s.activeUsers.last1, t.users) + " of users"} />
        <Stat label="Active last 7 days" value={s.activeUsers.last7} hint={pct(s.activeUsers.last7, t.users) + " of users"} />
        <Stat label="Active last 30 days" value={s.activeUsers.last30} hint={pct(s.activeUsers.last30, t.users) + " of users"} />
        <Stat label="Users with push enabled" value={t.usersWithPushToken} hint="device tokens" />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/users?filter=never-engaged"><Stat tone="warn" label="Signed up, never used a feature" value={s.inactive.neverEngaged} hint={`${pct(s.inactive.neverEngaged, t.users)} · no pet, like, chat, request or post →`} /></Link>
        <Link href="/users?filter=never-returned"><Stat tone="warn" label="Never came back after signup day" value={s.inactive.neverReturned} hint={`${pct(s.inactive.neverReturned, t.users)} →`} /></Link>
        <Link href="/users?filter=inactive30"><Stat tone="warn" label="Not seen in 30+ days" value={s.inactive.notSeen30d} hint={`${pct(s.inactive.notSeen30d, t.users)} →`} /></Link>
      </div>

      <Card title="New users per day (last 30 days)">
        <Bars label="New users per day" data={s.signups.series.map((d) => ({ label: d.date.slice(5), value: d.count }))} />
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Pets listed" value={t.pets} hint={`${t.activePets} active`} />
        <Stat label="Likes" value={t.likes} />
        <Stat label="Chats" value={t.chats} />
        <Stat label="Posts" value={t.posts} />
        <Stat label="Reports pending" value={t.reportsPending} tone={t.reportsPending ? "warn" : undefined} />
      </div>

      <Card title="Daily feature usage (last 14 days)" note="Pets use the document creation time. Likes, chats, requests and posts use their own timestamps. Chat messages are not counted.">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm tabular-nums">
            <thead className="text-xs text-slate-500">
              <tr><th className="text-left">Day</th><th>New users</th><th>Pets listed</th><th>Likes</th><th>Chats</th><th>Adoption requests</th><th>Posts</th></tr>
            </thead>
            <tbody>
              {[...s.activity].reverse().map((a) => (
                <tr key={a.date} className="border-t border-slate-100">
                  <td className="py-1 text-left">{a.date}</td><td>{a.newUsers}</td><td>{a.petsListed}</td><td>{a.likes}</td><td>{a.chats}</td><td>{a.requests}</td><td>{a.posts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Pets by category">
          <ul className="space-y-1 text-sm">{Object.entries(s.petsByCategory).map(([k, v]) => <li key={k} className="flex justify-between capitalize"><span>{k}</span><span className="tabular-nums">{v}</span></li>)}</ul>
        </Card>
        <Card title="Pets by status">
          <ul className="space-y-1 text-sm">{Object.entries(s.petsByStatus).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="tabular-nums">{v}</span></li>)}</ul>
        </Card>
        <Card title="Adoption requests">
          <ul className="space-y-1 text-sm">{Object.entries(t.adoptionRequests).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="tabular-nums">{v}</span></li>)}</ul>
        </Card>
      </div>

      <Card title="Top pet listers">
        <ul className="divide-y divide-slate-100 text-sm">
          {s.topListers.map((u) => (
            <li key={u.uid} className="flex items-center justify-between py-1.5">
              <Link href={`/users/${u.uid}`} className="min-w-0 truncate hover:underline">{u.name || u.email || u.uid} <span className="text-xs text-slate-500">{u.name && u.email}</span></Link>
              <span className="tabular-nums">{u.count} pets</span>
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-xs text-slate-500">
        “Active” = last sign-in or token refresh, so it is an approximation (not screen-level analytics). Day buckets use UTC{s.timezoneOffsetMin >= 0 ? "+" : ""}{s.timezoneOffsetMin / 60}h.
      </p>
    </div>
  );
}
