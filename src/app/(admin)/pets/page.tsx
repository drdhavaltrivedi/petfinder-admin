"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Empty, ErrorBox, Spinner, btnGhost, input } from "@/components/ui";
import { api, fmtDay } from "@/lib/api";

interface P { id: string; name: string; category: string; status: string; gender: string; owner: string; ownerEmail: string; ownerName: string; photo: string; created: number }
interface Res { total: number; page: number; pageSize: number; pets: P[] }

export default function PetsPage() {
  const [q, setQ] = useState(""); const [owner, setOwner] = useState(""); const [category, setCategory] = useState(""); const [status, setStatus] = useState("");
  const [applied, setApplied] = useState({ q: "", owner: "", category: "", status: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Res | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true); setError(null);
    const p = new URLSearchParams({ page: String(page), ...Object.fromEntries(Object.entries(applied).filter(([, v]) => v)) });
    api<Res>(`/api/admin/pets?${p}`).then((r) => live && setData(r)).catch((e) => live && setError(`Failed to load pets: ${(e as Error).message}`)).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [applied, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Pets {data && <span className="text-sm font-normal text-slate-500">({data.total})</span>}</h1>
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied({ q, owner, category, status }); }} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-5">
        <input className={input} placeholder="Pet name" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className={input} placeholder="Owner email / name / uid" value={owner} onChange={(e) => setOwner(e.target.value)} />
        <select className={input} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All types</option><option value="dog">Dog</option><option value="cat">Cat</option><option value="bird">Bird</option></select>
        <select className={input} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option>Active</option><option>Deactivated</option><option>Deactive</option></select>
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">Apply</button>
      </form>
      {error && <ErrorBox message={error} />}
      {loading && <Spinner label="Loading pets…" />}
      {!loading && !error && data?.pets.length === 0 && <Empty>No pets match.</Empty>}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data?.pets.map((p) => (
          <li key={p.id} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.photo ? <img src={p.photo} alt="" className="h-16 w-16 rounded-lg object-cover" /> : <div className="h-16 w-16 rounded-lg bg-slate-200" />}
            <div className="min-w-0 text-sm">
              <div className="font-medium">{p.name || "(unnamed)"}</div>
              <div className="text-xs capitalize text-slate-500">{p.category} · {p.gender || "—"} · {p.status}</div>
              <Link href={`/users/${p.owner}`} className="block truncate text-xs text-slate-600 hover:underline">{p.ownerName || p.ownerEmail || p.owner}</Link>
              <div className="text-xs text-slate-400">Listed {fmtDay(p.created)}</div>
            </div>
          </li>
        ))}
      </ul>
      {data && pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button className={btnGhost} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button className={btnGhost} disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
