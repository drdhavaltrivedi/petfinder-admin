"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Avatar, Empty, ErrorBox, Spinner, btnGhost, input } from "@/components/ui";
import { ago, api, fmtDay } from "@/lib/api";

interface U { uid: string; email: string; name: string; photo: string; address: string; hasLocation: boolean; created: number; lastSeen: number; pets: number; engaged: boolean; disabled: boolean }
interface Res { total: number; page: number; pageSize: number; geoNote: string | null; users: U[] }

const FILTERS: [string, string][] = [
  ["all", "All users"], ["new7", "Signed up: last 7 days"], ["new30", "Signed up: last 30 days"], ["active7", "Active: last 7 days"],
  ["never-engaged", "Never used a feature"], ["never-returned", "Never returned after signup day"], ["inactive30", "Not seen 30+ days"], ["has-pets", "Has listed pets"],
];

function UsersInner() {
  const sp = useSearchParams();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(sp.get("filter") ?? "all");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("");
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState({ q: "", filter: sp.get("filter") ?? "all", address: "", lat: "", lng: "", radius: "" });
  const [data, setData] = useState<Res | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const params = useCallback((extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ filter: applied.filter, ...extra });
    if (applied.q) p.set("q", applied.q);
    if (applied.address) p.set("address", applied.address);
    if (applied.lat && applied.lng && applied.radius) { p.set("lat", applied.lat); p.set("lng", applied.lng); p.set("radius", applied.radius); }
    return p.toString();
  }, [applied]);

  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    api<Res>(`/api/admin/users?${params({ page: String(page) })}`)
      .then((r) => live && setData(r))
      .catch((e) => live && setError(`Failed to load users: ${(e as Error).message}`))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [params, page]);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setApplied({ q: q.trim(), filter, address: address.trim(), lat, lng, radius });
  }

  async function exportCsv() {
    try {
      const r = await api<{ users: { uid: string; email: string; name: string; created: number; lastSeen: number; pets: number; engaged: boolean }[] }>(`/api/admin/users?${params({ all: "1" })}`);
      const esc = (v: string | number | boolean) => `"${String(v).replace(/"/g, '""')}"`;
      const rows = [["uid", "email", "name", "signed_up", "last_active", "pets", "used_a_feature"], ...r.users.map((u) => [u.uid, u.email, u.name, new Date(u.created).toISOString(), new Date(u.lastSeen).toISOString(), u.pets, u.engaged])];
      const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv" }));
      Object.assign(document.createElement("a"), { href: url, download: `petfinder-users-${new Date().toISOString().slice(0, 10)}.csv` }).click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`Export failed: ${(e as Error).message}`);
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Users {data && <span className="text-sm font-normal text-slate-500">({data.total.toLocaleString()})</span>}</h1>
        <button className={`${btnGhost} ml-auto`} onClick={exportCsv}>Export CSV</button>
      </div>

      <form onSubmit={apply} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-4">
        <input className={`${input} md:col-span-2`} placeholder="Search email, name or uid" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={input} value={filter} onChange={(e) => setFilter(e.target.value)}>{FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <input className={input} placeholder="Address contains (e.g. Mumbai)" value={address} onChange={(e) => setAddress(e.target.value)} />
        <input className={input} placeholder="Near latitude" value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" />
        <input className={input} placeholder="Near longitude" value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" />
        <input className={input} placeholder="Radius (km)" value={radius} onChange={(e) => setRadius(e.target.value)} inputMode="decimal" />
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">Apply</button>
      </form>

      {data?.geoNote && <p className="text-xs text-amber-700">{data.geoNote}</p>}
      {error && <ErrorBox message={error} />}
      {loading && <Spinner label="Loading users (first load can take ~30s)…" />}
      {!loading && !error && data?.users.length === 0 && <Empty>No users match these filters.</Empty>}

      {data && data.users.length > 0 && (
        <div className={`overflow-x-auto rounded-xl border border-slate-200 bg-white ${loading ? "opacity-50" : ""}`}>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr><th className="p-3">User</th><th>Signed up</th><th>Last active</th><th>Pets</th><th>Address</th><th>Status</th></tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.uid} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3">
                    <Link href={`/users/${u.uid}`} className="flex items-center gap-2">
                      <Avatar url={u.photo} name={u.name || u.email} />
                      <span className="min-w-0"><span className="block truncate font-medium">{u.name || "—"}</span><span className="block truncate text-xs text-slate-500">{u.email || u.uid}</span></span>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">{fmtDay(u.created)}</td>
                  <td className="whitespace-nowrap">{ago(u.lastSeen)}</td>
                  <td>{u.pets}</td>
                  <td className="max-w-48 truncate">{u.address || "—"}</td>
                  <td>{u.disabled ? <span className="text-red-600">Disabled</span> : u.engaged ? "Engaged" : <span className="text-amber-700">No activity</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button className={btnGhost} disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page} of {pages.toLocaleString()}</span>
          <button className={btnGhost} disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  return <Suspense fallback={<Spinner />}><UsersInner /></Suspense>;
}
