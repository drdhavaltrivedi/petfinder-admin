"use client";

import { Activity, MessageCircle, PawPrint, UserCheck, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { BundleGate, DataStatus } from "@/components/DataStatus";
import { AreaChart, Card, Delta, Funnel, Stat } from "@/components/charts";
import { PageHeader } from "@/components/ui";
import { Globe2 } from "lucide-react";
import type { Stats } from "@/lib/shared";

const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "—");

function Geography({ g }: { g: Stats["geography"] }) {
  const shared = g.total - g.noLocation;
  const top = g.byCountry.slice(0, 12);
  const rest = g.byCountry.slice(12).reduce((n, c) => n + c.count, 0);
  const max = Math.max(1, ...top.map((c) => c.count));
  return (
    <Card title="Users by country" action={<Globe2 className="h-4 w-4 text-muted" />}
      note={`Country is read from the address users saved in the app. Only ${shared.toLocaleString()} of ${g.total.toLocaleString()} users (${pct(shared, g.total)}) have shared a location. Click a country to list its users.`}>
      <div className="mb-4 rounded-lg bg-surface-2 p-3">
        <div className="flex justify-between text-sm"><span className="font-medium">No location shared</span><span className="tabular-nums">{g.noLocation.toLocaleString()} · {pct(g.noLocation, g.total)}</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-border"><div className="h-2 rounded-full bg-muted" style={{ width: `${(g.noLocation / g.total) * 100}%` }} /></div>
      </div>
      <ul className="space-y-2.5">
        {top.map((c) => (
          <li key={c.country}>
            <Link href={`/users?address=${encodeURIComponent(c.q)}`} className="group block">
              <div className="flex justify-between text-sm"><span className="group-hover:underline">{c.country}</span><span className="tabular-nums text-muted">{c.count.toLocaleString()} · {pct(c.count, g.total)}</span></div>
              <div className="mt-1 h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full bg-accent" style={{ width: `${(c.count / max) * 100}%` }} /></div>
            </Link>
          </li>
        ))}
      </ul>
      {(rest > 0 || g.unknownCountry > 0) && (
        <p className="mt-3 text-xs text-muted">
          {rest > 0 && <>+ {g.byCountry.length - 12} other countries ({rest.toLocaleString()} users). </>}
          {g.unknownCountry > 0 && <>{g.unknownCountry} shared a location but the country could not be read.</>}
        </p>
      )}
    </Card>
  );
}

function Body({ s }: { s: Stats }) {
  const t = s.totals;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Users className="h-3.5 w-3.5" />} label="Total users" value={t.users} />
        <Stat icon={<UserPlus className="h-3.5 w-3.5" />} label="New today" value={s.signups.today} />
        <Stat icon={<UserPlus className="h-3.5 w-3.5" />} label="New · 7 days" value={s.signups.last7}><Delta now={s.signups.last7} prev={s.signups.prev7} /></Stat>
        <Stat icon={<UserPlus className="h-3.5 w-3.5" />} label="New · 30 days" value={s.signups.last30}><Delta now={s.signups.last30} prev={s.signups.prev30} /></Stat>
        <Stat icon={<Activity className="h-3.5 w-3.5" />} label="Active · 24h" value={s.activeUsers.last1} hint={`${pct(s.activeUsers.last1, t.users)} of users`} />
        <Stat icon={<Activity className="h-3.5 w-3.5" />} label="Active · 7 days" value={s.activeUsers.last7} hint={`${pct(s.activeUsers.last7, t.users)} of users`} />
        <Stat icon={<Activity className="h-3.5 w-3.5" />} label="Active · 30 days" value={s.activeUsers.last30} hint={`${pct(s.activeUsers.last30, t.users)} of users`} />
        <Stat icon={<UserCheck className="h-3.5 w-3.5" />} label="Push-enabled devices" value={t.usersWithPushToken} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/users?filter=never-engaged"><Stat tone="warn" label="Signed up, never used a feature" value={s.inactive.neverEngaged} hint={`${pct(s.inactive.neverEngaged, t.users)} · no pet, like, chat, request or post →`} /></Link>
        <Link href="/users?filter=never-returned"><Stat tone="warn" label="Never came back after signup day" value={s.inactive.neverReturned} hint={`${pct(s.inactive.neverReturned, t.users)} →`} /></Link>
        <Link href="/users?filter=inactive30"><Stat tone="warn" label="Not seen in 30+ days" value={s.inactive.notSeen30d} hint={`${pct(s.inactive.notSeen30d, t.users)} →`} /></Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3"><Card title="New users per day · last 30 days"><AreaChart label="New users per day" data={s.signups.series.map((d) => ({ label: d.date, value: d.count }))} /></Card></div>
        <div className="lg:col-span-2"><Card title="Engagement funnel" note="Distinct users at each step. Most signups never get past the first step.">
          <Funnel steps={[
            { label: "Signed up", value: s.funnel.signedUp }, { label: "Listed a pet", value: s.funnel.listedPet }, { label: "Liked a pet", value: s.funnel.liked },
            { label: "Started a chat", value: s.funnel.chatted }, { label: "Requested adoption", value: s.funnel.requested }, { label: "Adoption approved", value: s.funnel.approved },
          ]} />
        </Card></div>
      </div>

      <Geography g={s.geography} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat icon={<PawPrint className="h-3.5 w-3.5" />} label="Pets listed" value={t.pets} hint={`${t.activePets} active`} />
        <Stat label="Likes" value={t.likes} />
        <Stat icon={<MessageCircle className="h-3.5 w-3.5" />} label="Chats" value={t.chats} />
        <Stat label="Posts" value={t.posts} />
        <Stat label="Reports pending" value={t.reportsPending} tone={t.reportsPending ? "warn" : undefined} />
      </div>

      <Card title="Daily feature usage · last 14 days" note="Pets use document creation time. Chat messages are not counted.">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm tabular-nums">
            <thead className="text-xs text-muted"><tr className="[&>th]:pb-2 [&>th]:font-medium"><th className="text-left">Day</th><th>New users</th><th>Pets</th><th>Likes</th><th>Chats</th><th>Requests</th><th>Posts</th></tr></thead>
            <tbody>
              {[...s.activity].reverse().map((a) => (
                <tr key={a.date} className="border-t border-border"><td className="py-1.5 text-left text-muted">{a.date}</td><td>{a.newUsers}</td><td>{a.petsListed}</td><td>{a.likes}</td><td>{a.chats}</td><td>{a.requests}</td><td>{a.posts}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {([["Pets by category", s.petsByCategory], ["Pets by status", s.petsByStatus], ["Adoption requests", t.adoptionRequests]] as const).map(([title, o]) => (
          <Card key={title} title={title}>
            <ul className="space-y-1.5 text-sm">{Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => <li key={k} className="flex justify-between capitalize"><span>{k}</span><span className="tabular-nums text-muted">{v}</span></li>)}</ul>
          </Card>
        ))}
      </div>

      <Card title="Top pet listers">
        <ul className="divide-y divide-border text-sm">
          {s.topListers.map((u) => (
            <li key={u.uid} className="flex items-center justify-between gap-3 py-2">
              <Link href={`/users/${u.uid}`} className="min-w-0 truncate hover:underline">{u.name || u.email || u.uid} {u.name && <span className="text-xs text-muted">{u.email}</span>}</Link>
              <span className="shrink-0 tabular-nums text-muted">{u.count} pets</span>
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-xs text-muted">“Active” uses last sign-in or token refresh, so it is an approximation, not screen-level analytics. Days use UTC{s.timezoneOffsetMin >= 0 ? "+" : ""}{s.timezoneOffsetMin / 60}h.</p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" sub="Overview of users, activity and engagement" actions={<DataStatus />} />
      <BundleGate>{(b) => <Body s={b.stats} />}</BundleGate>
    </>
  );
}
