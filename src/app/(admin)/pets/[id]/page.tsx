"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { None, PersonLink, Section, statusTone } from "@/components/people";
import { RawFields } from "@/components/RawFields";
import { Stat } from "@/components/charts";
import { Badge, ErrorBox, PageHeader, Skeleton } from "@/components/ui";
import { fmtDay, fmtMs } from "@/lib/api";
import type { Person } from "@/lib/insightTypes";
import { useApi } from "@/lib/query";

interface Pet {
  id: string; created: number | null; updated: number | null; raw: Record<string, unknown>;
  name: string; category: string; gender: string; status: string; bio: string; height: string; weight: string;
  birthDate: number | null; adoptionDate: number | null; qualities: string[]; media: string[];
  owner: Person; breed: { id: string; name: string; type: string; description: string; temperament: string[] } | null;
  likes: { at: number | null; user: Person }[];
  requests: { id: string; status: string; message: string; at: number | null; from: Person; owner: Person }[];
  chats: { id: string; messages: number; updatedAt: number | null; people: Person[]; last: { text: string; at: number | null; senderName: string } | null }[];
}
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div><dt className="text-xs text-muted">{k}</dt><dd className="text-sm">{v || "—"}</dd></div>;

export default function PetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: p, error, reload } = useApi<Pet>(`/api/admin/pets/${id}`);
  if (error) return <ErrorBox message={`Failed to load pet: ${error}`} onRetry={reload} />;
  if (!p) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-48" /><Skeleton className="h-48" /></div>;
  const status = p.status === "Deactive" ? "Deactivated" : p.status;
  return (
    <div className="space-y-6">
      <Link href="/pets" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" />All pets</Link>
      <PageHeader
        title={p.name || "(unnamed pet)"}
        sub={<span className="flex flex-wrap items-center gap-2"><Badge>{p.category}</Badge>{p.gender && <Badge>{p.gender}</Badge>}<Badge tone={statusTone(status)}>{status}</Badge><span className="font-mono text-xs">{p.id}</span></span>}
        actions={<button className="text-sm text-accent underline" onClick={reload}>Reload</button>}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Likes" value={p.likes.length} /><Stat label="Adoption requests" value={p.requests.length} /><Stat label="Chats" value={p.chats.length} /><Stat label="Photos / videos" value={p.media.length} />
      </div>
      {p.media.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {p.media.map((m) => /\.(mp4|mov|webm)(\?|$)/i.test(m)
            ? <video key={m} src={m} controls className="h-56 rounded-xl bg-surface-2" />
            // eslint-disable-next-line @next/next/no-img-element
            : <a key={m} href={m} target="_blank" rel="noreferrer"><img src={m} alt="" loading="lazy" className="h-56 rounded-xl bg-surface-2 object-cover" /></a>)}
        </div>
      )}
      <dl className="grid gap-x-8 gap-y-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-3">
        <Row k="Owner" v={<PersonLink p={p.owner} />} />
        <Row k="Breed" v={p.breed ? `${p.breed.name}${p.breed.type ? ` (${p.breed.type})` : ""}` : ""} />
        <Row k="Listed" v={fmtMs(p.created)} /><Row k="Last changed" v={fmtMs(p.updated)} />
        <Row k="Birth date" v={p.birthDate ? fmtDay(p.birthDate) : ""} /><Row k="Adoption date" v={p.adoptionDate ? fmtDay(p.adoptionDate) : ""} />
        <Row k="Height" v={p.height} /><Row k="Weight" v={p.weight} />
        <Row k="Qualities" v={p.qualities.length ? <span className="flex flex-wrap gap-1">{p.qualities.map((q) => <Badge key={q}>{q}</Badge>)}</span> : ""} />
      </dl>
      {p.bio && <Section title="Bio"><p className="whitespace-pre-wrap rounded-xl border border-border bg-surface p-4 text-sm">{p.bio}</p></Section>}
      {p.breed?.description && <Section title={`About the breed: ${p.breed.name}`}><p className="text-sm text-muted">{p.breed.description}</p></Section>}

      <Section title="Adoption requests" count={p.requests.length}>
        {p.requests.length === 0 ? <None /> : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface text-sm">{p.requests.map((r) => (
            <li key={r.id} className="space-y-1 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span><PersonLink p={r.from} /> <span className="text-muted">asked</span> <PersonLink p={r.owner} /></span><span className="flex items-center gap-2"><Badge tone={statusTone(r.status)}>{r.status}</Badge><span className="text-xs text-muted">{fmtMs(r.at)}</span></span></div>{r.message && <p className="text-muted">“{r.message}”</p>}</li>))}</ul>)}
      </Section>
      <Section title="Chats about this pet" count={p.chats.length}>
        {p.chats.length === 0 ? <None /> : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface text-sm">{p.chats.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3"><div className="min-w-0"><div>{c.people.map((x, i) => <span key={x.uid}>{i > 0 && " ↔ "}<PersonLink p={x} /></span>)}</div>{c.last && <div className="truncate text-xs text-muted">“{c.last.text}” · {c.last.senderName}</div>}</div><div className="flex items-center gap-3"><span className="text-xs text-muted">{c.messages} msgs</span><Link href={`/chats/${c.id}`} className="text-accent underline">Open chat</Link></div></li>))}</ul>)}
      </Section>
      <Section title="Likes" count={p.likes.length}>
        {p.likes.length === 0 ? <None /> : <ul className="grid gap-2 text-sm sm:grid-cols-2">{p.likes.slice(0, 60).map((l, i) => <li key={i} className="flex justify-between rounded-lg border border-border bg-surface px-3 py-2"><PersonLink p={l.user} /><span className="text-xs text-muted">{fmtDay(l.at)}</span></li>)}</ul>}
      </Section>
      <RawFields data={p.raw} />
    </div>
  );
}
