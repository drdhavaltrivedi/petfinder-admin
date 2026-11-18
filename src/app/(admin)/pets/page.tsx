"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { BundleGate, DataStatus } from "@/components/DataStatus";
import { Pagination, paginate } from "@/components/Pagination";
import { Badge, Chip, Empty, PageHeader, Spinner, input } from "@/components/ui";
import { fmtDay } from "@/lib/api";
import type { Bundle } from "@/lib/shared";
import { useUrlState } from "@/lib/urlstate";

const DEFAULTS = { q: "", type: "", status: "", page: "1", size: "24" };
const normStatus = (s: string) => (s === "Deactive" ? "Deactivated" : s); // the app stores both spellings

function Body({ b }: { b: Bundle }) {
  const [u, set] = useUrlState(DEFAULTS);
  const [q, setQ] = useState(u.q);
  const owners = useMemo(() => new Map(b.users.map((x) => [x[0], x])), [b.users]);

  const base = useMemo(() => {
    const t = u.q.trim().toLowerCase();
    return b.pets.filter((p) => {
      if (!t) return true;
      const o = owners.get(p.owner);
      return p.name.toLowerCase().includes(t) || !!o?.[1].toLowerCase().includes(t) || !!o?.[2].toLowerCase().includes(t);
    });
  }, [b.pets, owners, u.q]);
  const count = (f: (p: (typeof base)[number]) => boolean) => base.filter(f).length;
  const rows = base.filter((p) => (!u.type || p.category === u.type) && (!u.status || normStatus(p.status) === u.status)).sort((a, c) => c.created - a.created);

  const size = Number(u.size) || 24;
  const reset = (patch: Partial<typeof DEFAULTS>) => set({ ...patch, page: "1" });

  return (
    <div className="space-y-4">
      <form className="relative max-w-md" onSubmit={(e) => { e.preventDefault(); reset({ q: q.trim() }); }}>
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
        <input className={`${input} pl-9`} placeholder="Search pet name or owner — press Enter" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => q.trim() !== u.q && reset({ q: q.trim() })} />
      </form>
      <div className="flex flex-wrap gap-2">
        <Chip active={!u.type} count={base.length} onClick={() => reset({ type: "" })}>All types</Chip>
        {["dog", "cat", "bird"].map((t) => <Chip key={t} active={u.type === t} count={count((p) => p.category === t)} onClick={() => reset({ type: t })}><span className="capitalize">{t}</span></Chip>)}
        <span className="mx-1 w-px bg-border" />
        <Chip active={!u.status} onClick={() => reset({ status: "" })}>Any status</Chip>
        {["Active", "Deactivated"].map((s) => <Chip key={s} active={u.status === s} count={count((p) => normStatus(p.status) === s)} onClick={() => reset({ status: s })}>{s}</Chip>)}
      </div>

      {rows.length === 0 ? <Empty>No pets match these filters.</Empty> : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {paginate(rows, Number(u.page) || 1, size).map((p) => {
              const o = owners.get(p.owner);
              return (
                <li key={p.id} className="flex gap-3 rounded-xl border border-border bg-surface p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.photo ? <img src={p.photo} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-lg bg-surface-2 object-cover" /> : <div className="h-20 w-20 shrink-0 rounded-lg bg-surface-2" />}
                  <div className="min-w-0 text-sm">
                    <div className="truncate font-medium">{p.name || "(unnamed)"}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1"><Badge>{p.category}</Badge>{p.gender && <Badge>{p.gender}</Badge>}<Badge tone={normStatus(p.status) === "Active" ? "success" : "neutral"}>{normStatus(p.status)}</Badge></div>
                    <Link href={`/users/${p.owner}`} className="mt-1 block truncate text-xs text-muted hover:underline">{o?.[2] || o?.[1] || p.owner}</Link>
                    <div className="text-xs text-muted">Listed {fmtDay(p.created)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={Number(u.page) || 1} size={size} total={rows.length} onPage={(p) => set({ page: String(p) })} onSize={(s) => set({ size: String(s), page: "1" })} />
        </>
      )}
    </div>
  );
}

export default function PetsPage() {
  return (
    <>
      <PageHeader title="Pets" sub="Every listed pet, from the cached data" actions={<DataStatus />} />
      <Suspense fallback={<Spinner />}><BundleGate>{(b) => <Body b={b} />}</BundleGate></Suspense>
    </>
  );
}
