"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Stat } from "@/components/charts";
import { Avatar, Badge, ErrorBox, PageHeader, Skeleton, btnPrimary } from "@/components/ui";
import { fmtMs } from "@/lib/api";
import { useApi } from "@/lib/query";
import type { Detail } from "../quick";

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div><dt className="text-xs text-muted">{k}</dt><dd className="text-sm">{v}</dd></div>;

export default function UserDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const { data: u, error, reload } = useApi<Detail>(`/api/admin/users/${uid}`);

  if (error) return <ErrorBox message={`Failed to load user: ${error}`} onRetry={reload} />;
  if (!u) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><div className="grid grid-cols-4 gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div><Skeleton className="h-48" /></div>;

  return (
    <div className="space-y-6">
      <Link href="/users" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" />All users</Link>
      <PageHeader
        title={<span className="flex items-center gap-3"><Avatar url={u.photo} name={u.name || u.email} size={44} />{u.name || "(no name)"}</span>}
        sub={<>{u.email} · <span className="font-mono text-xs">{u.uid}</span></>}
        actions={<><button className="text-sm text-accent underline" onClick={reload}>Reload</button><Link href={`/matches?a=${u.uid}`} className={btnPrimary}>Connect with another user</Link></>}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Pets listed" value={u.pets.length} /><Stat label="Likes given" value={u.counts.likes} /><Stat label="Chats" value={u.counts.chats} /><Stat label="Push devices" value={u.counts.pushTokens} />
      </div>
      <dl className="grid gap-x-8 gap-y-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-2">
        <Row k="Signed up" v={fmtMs(u.created)} /><Row k="Last sign-in" v={fmtMs(u.lastSignIn)} />
        <Row k="Last token refresh (≈ last active)" v={fmtMs(u.lastRefresh)} /><Row k="Sign-in methods" v={u.providers.join(", ") || "—"} />
        <Row k="Address" v={u.address || "—"} /><Row k="Location" v={u.location ? `${u.location.lat.toFixed(4)}, ${u.location.lng.toFixed(4)}` : "Not shared"} />
        <Row k="Gender / favourite pet" v={`${u.gender || "—"} / ${u.favoritePet || "—"}`} />
        <Row k="Reports against user" v={<>{u.reportCount} {u.disabled && <Badge tone="danger">Account disabled</Badge>}</>} />
      </dl>
      <section>
        <h2 className="mb-2 font-semibold">Pets ({u.pets.length})</h2>
        {u.pets.length === 0 ? <p className="text-sm text-muted">No pets listed.</p> : (
          <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">{u.pets.map((p) => (
            <li key={p.id} className="flex gap-3 rounded-xl border border-border bg-surface p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.photo ? <img src={p.photo} alt="" className="h-14 w-14 rounded-lg object-cover" /> : <div className="h-14 w-14 rounded-lg bg-surface-2" />}
              <div className="text-sm"><div className="font-medium">{p.name || "(unnamed)"}</div><div className="text-xs capitalize text-muted">{p.category} · {p.status}</div></div>
            </li>))}</ul>)}
      </section>
      <section>
        <h2 className="mb-2 font-semibold">Adoption requests ({u.adoptionRequests.length})</h2>
        {u.adoptionRequests.length === 0 ? <p className="text-sm text-muted">None.</p> : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface text-sm">{u.adoptionRequests.map((r) => (
            <li key={r.id} className="flex justify-between p-3"><span className="capitalize">{r.direction} · {r.status}</span><span className="text-muted">{fmtMs(r.at)}</span></li>))}</ul>)}
      </section>
    </div>
  );
}
