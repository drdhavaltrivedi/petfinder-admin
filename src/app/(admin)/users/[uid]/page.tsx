"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { None, PersonLink, Section, Thumb, statusTone } from "@/components/people";
import { RawFields } from "@/components/RawFields";
import { Stat } from "@/components/charts";
import { Avatar, Badge, ErrorBox, PageHeader, Skeleton, btnPrimary } from "@/components/ui";
import { ago, fmtDay, fmtMs } from "@/lib/api";
import { useApi } from "@/lib/query";
import type { Detail } from "../quick";

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div><dt className="text-xs text-muted">{k}</dt><dd className="break-words text-sm">{v || "—"}</dd></div>;
const List = ({ children }: { children: React.ReactNode }) => <ul className="divide-y divide-border rounded-xl border border-border bg-surface text-sm">{children}</ul>;

export default function UserDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const { data: u, error, reload } = useApi<Detail>(`/api/admin/users/${uid}`);

  if (error) return <ErrorBox message={`Failed to load user: ${error}`} onRetry={reload} />;
  if (!u) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><div className="grid grid-cols-4 gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div><Skeleton className="h-48" /></div>;

  const profileDone = !!(u.name && u.photo && u.gender && u.favoritePet);
  return (
    <div className="space-y-6">
      <Link href="/users" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" />All users</Link>
      <PageHeader
        title={<span className="flex items-center gap-3"><Avatar url={u.photo} name={u.name || u.email} size={44} />{u.name || "(no name)"}</span>}
        sub={<>{u.email} · <span className="font-mono text-xs">{u.uid}</span></>}
        actions={<><button className="text-sm text-accent underline" onClick={reload}>Reload</button><Link href={`/matches?a=${u.uid}`} className={btnPrimary}>Connect with another user</Link></>}
      />
      <div className="flex flex-wrap gap-2">
        {u.disabled && <Badge tone="danger">Account disabled</Badge>}
        <Badge tone={u.emailVerified ? "success" : "warn"}>{u.emailVerified ? "Email verified" : "Email not verified"}</Badge>
        <Badge tone={profileDone ? "success" : "warn"}>{profileDone ? "Profile complete" : "Profile incomplete"}</Badge>
        {u.isOwner && <Badge tone="accent">Pet owner</Badge>}
        {u.location ? <Badge tone="success">Location shared</Badge> : <Badge>No location</Badge>}
        {u.reportCount > 0 && <Badge tone="danger">{u.reportCount} reports against</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <Stat label="Pets listed" value={u.pets.length} /><Stat label="Pets viewed" value={u.counts.viewedPets} /><Stat label="Likes given" value={u.counts.likes} />
        <Stat label="Chats" value={u.counts.chats} /><Stat label="Requests" value={u.adoptionRequests.length} /><Stat label="Posts" value={u.counts.posts} /><Stat label="Push devices" value={u.counts.pushTokens} />
      </div>

      <dl className="grid gap-x-8 gap-y-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-3">
        <Row k="Signed up" v={`${fmtMs(u.created)}`} /><Row k="Last sign-in" v={fmtMs(u.lastSignIn)} /><Row k="Last token refresh (≈ last active)" v={u.lastRefresh ? `${fmtMs(u.lastRefresh)} (${ago(u.lastRefresh)})` : ""} />
        <Row k="Sign-in methods" v={u.providers.join(", ")} /><Row k="Phone" v={u.phone} /><Row k="Address" v={u.address} />
        <Row k="Location" v={u.location ? <a className="text-accent underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${u.location.lat},${u.location.lng}`}>{u.location.lat.toFixed(4)}, {u.location.lng.toFixed(4)}</a> : "Not shared"} />
        <Row k="Gender" v={u.gender} /><Row k="Favourite pet" v={u.favoritePet} />
      </dl>

      {u.preferences && (
        <Section title="Matching preferences">
          <dl className="grid gap-x-8 gap-y-2 rounded-xl border border-border bg-surface p-4 md:grid-cols-3">
            {Object.entries(u.preferences).map(([k, v]) => <Row key={k} k={k} v={Array.isArray(v) ? v.join(", ") : String(v)} />)}
          </dl>
        </Section>
      )}

      <Section title="Pets" count={u.pets.length}>
        {u.pets.length === 0 ? <None>No pets listed.</None> : (
          <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">{u.pets.map((p) => (
            <li key={p.id}><Link href={`/pets/${p.id}`} className="flex gap-3 rounded-xl border border-border bg-surface p-3 hover:bg-surface-2"><Thumb url={p.photo} size={56} />
              <div className="text-sm"><div className="font-medium">{p.name || "(unnamed)"}</div><div className="text-xs capitalize text-muted">{p.category}{p.gender ? ` · ${p.gender}` : ""}</div><Badge tone={statusTone(p.status === "Deactive" ? "Deactivated" : p.status)}>{p.status === "Deactive" ? "Deactivated" : p.status}</Badge></div></Link></li>))}</ul>)}
      </Section>

      <Section title="Adoption requests" count={u.adoptionRequests.length}>
        {u.adoptionRequests.length === 0 ? <None /> : (
          <List>{u.adoptionRequests.map((r) => (
            <li key={r.id} className="space-y-1 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="capitalize">{r.direction} · <Link className="underline" href={`/pets/${r.pet.id}`}>{r.pet.name || "pet"}</Link> · {r.direction === "sent" ? "to " : "from "}<PersonLink p={r.other} /></span>
                <span className="flex items-center gap-2"><Badge tone={statusTone(r.status)}>{r.status}</Badge><span className="text-xs text-muted">{fmtMs(r.at)}</span></span>
              </div>
              {r.message && <p className="text-muted">“{r.message}”</p>}
            </li>))}</List>)}
      </Section>

      <Section title="Chats" count={u.chats.length}>
        {u.chats.length === 0 ? <None /> : (
          <List>{u.chats.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0"><div>with {c.people.map((x, i) => <span key={x.uid}>{i > 0 && ", "}<PersonLink p={x} /></span>)} · about <Link className="underline" href={`/pets/${c.pet.id}`}>{c.pet.name || "a pet"}</Link></div>{c.last && <div className="truncate text-xs text-muted">“{c.last.text}” · {fmtMs(c.last.at)}</div>}</div>
              <div className="flex items-center gap-3"><span className="text-xs text-muted">{c.messages} msgs</span><Link href={`/chats/${c.id}`} className="text-accent underline">Open chat</Link></div>
            </li>))}</List>)}
      </Section>

      <Section title="Pets this user liked" count={u.counts.likes}>
        {u.likedPets.length === 0 ? <None /> : <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">{u.likedPets.map((l, i) => <li key={i}><Link href={`/pets/${l.pet.id}`} className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2 text-sm hover:bg-surface-2"><Thumb url={l.pet.photo} size={36} /><span className="min-w-0 flex-1 truncate">{l.pet.name || "(unnamed)"}</span><span className="text-xs text-muted">{fmtDay(l.at)}</span></Link></li>)}</ul>}
      </Section>

      <Section title="Community posts" count={u.posts.length}>
        {u.posts.length === 0 ? <None /> : <List>{u.posts.map((p) => <li key={p.id} className="flex gap-3 p-3"><Thumb url={p.photo} size={48} /><div className="min-w-0"><div className="text-xs text-muted">{p.category} · {fmtMs(p.at)} · {p.likes} likes · {p.comments} comments{p.reports ? ` · ${p.reports} reports` : ""}</div><p className="line-clamp-3">{p.caption}</p></div></li>)}</List>}
      </Section>

      <Section title="Reports and blocks">
        <div className="grid gap-4 md:grid-cols-2">
          <div><h3 className="mb-1 text-xs font-medium text-muted">Reports against this user ({u.reports.against.length})</h3>{u.reports.against.length === 0 ? <None /> : <List>{u.reports.against.map((r) => <li key={r.id} className="space-y-0.5 p-3"><div className="flex justify-between"><span>by <PersonLink p={r.by} /></span><Badge tone={statusTone(r.status)}>{r.status}</Badge></div><div className="text-xs text-muted">{r.reason} · {fmtMs(r.at)}</div>{r.description && <p>{r.description}</p>}</li>)}</List>}</div>
          <div><h3 className="mb-1 text-xs font-medium text-muted">Reports filed by this user ({u.reports.filed.length})</h3>{u.reports.filed.length === 0 ? <None /> : <List>{u.reports.filed.map((r) => <li key={r.id} className="space-y-0.5 p-3"><div className="flex justify-between"><span>against <PersonLink p={r.against} /></span><Badge tone={statusTone(r.status)}>{r.status}</Badge></div><div className="text-xs text-muted">{r.reason} · {fmtMs(r.at)}</div>{r.description && <p>{r.description}</p>}</li>)}</List>}</div>
          <div><h3 className="mb-1 text-xs font-medium text-muted">Users this person blocked ({u.blocks.made.length})</h3>{u.blocks.made.length === 0 ? <None /> : <List>{u.blocks.made.map((b, i) => <li key={i} className="flex justify-between p-3"><PersonLink p={b.user} /><span className="text-xs text-muted">{fmtDay(b.at)}</span></li>)}</List>}</div>
          <div><h3 className="mb-1 text-xs font-medium text-muted">Blocked by ({u.blocks.received.length})</h3>{u.blocks.received.length === 0 ? <None /> : <List>{u.blocks.received.map((b, i) => <li key={i} className="flex justify-between p-3"><PersonLink p={b.user} /><span className="text-xs text-muted">{fmtDay(b.at)}</span></li>)}</List>}</div>
        </div>
      </Section>

      <Section title="Recent notifications" count={u.notifications.length}>
        {u.notifications.length === 0 ? <None /> : <List>{u.notifications.map((n) => <li key={n.id} className="p-3"><div className="flex justify-between gap-2"><span className="font-medium">{n.title}</span><span className="text-xs text-muted">{fmtMs(n.at)} · {n.read ? "read" : "unread"}</span></div><p className="text-muted">{n.body}</p></li>)}</List>}
      </Section>

      <Section title="Devices (push)" count={u.devices.length}>
        {u.devices.length === 0 ? <None>No registered devices — this user cannot receive push notifications.</None> : <p className="text-sm">{u.devices.map((d, i) => <Badge key={i}>{d.type || "unknown"}</Badge>)}</p>}
      </Section>

      <RawFields data={u.raw} title="All stored profile fields" />
    </div>
  );
}
