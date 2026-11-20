"use client";

import { Download, Filter, MapPin, Search, SlidersHorizontal, X, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { BundleGate, DataStatus } from "@/components/DataStatus";
import { Pagination, paginate } from "@/components/Pagination";
import { Avatar, Badge, Chip, Drawer, Empty, PageHeader, Spinner, btnGhost, btnPrimary, input } from "@/components/ui";
import { useBundle } from "@/lib/bundle";
import { ago, fmtDay } from "@/lib/api";
import { F, FACETS, METHOD_LABELS, PRESETS, PROFILE_BITS, USER_FILTERS, countryFromAddress, distanceKm, hasF, matchesFacets, matchesFilter, type Bundle, type UserTuple } from "@/lib/shared";
import { useUrlState } from "@/lib/urlstate";
import { UserQuickView } from "./quick";

const FACET_KEYS = FACETS.map((f) => f.key);
const DEFAULTS = { q: "", filter: "all", sort: "created", dir: "desc", page: "1", size: "25", address: "", lat: "", lng: "", radius: "", act: "", prof: "", meth: "", loc: "", acct: "", seen: "", pets: "", country: "", from: "", to: "" };
const SORTS: Record<string, (a: UserTuple, b: UserTuple, pets: Map<string, number>) => number> = {
  created: (a, b) => a[3] - b[3],
  lastSeen: (a, b) => a[4] - b[4],
  email: (a, b) => a[1].localeCompare(b[1]),
  name: (a, b) => (a[2] || a[1]).localeCompare(b[2] || b[1]),
  pets: (a, b, p) => (p.get(a[0]) ?? 0) - (p.get(b[0]) ?? 0),
};

function Body({ b }: { b: Bundle }) {
  const { petCount, engaged } = useBundle();
  const [u, set] = useUrlState(DEFAULTS);
  const [qDraft, setQDraft] = useState(u.q);
  const [moreOpen, setMoreOpen] = useState(!!(u.address || u.lat));
  const [filtersOpen, setFiltersOpen] = useState(FACET_KEYS.some((k) => u[k as keyof typeof u]) || !!(u.country || u.from || u.to));
  const [openUid, setOpenUid] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const ctx = useMemo(() => ({ now, engaged, petCount }), [now, engaged, petCount]);
  const geoByUid = useMemo(() => new Map(b.geo.map((g) => [g.uid, g])), [b.geo]);

  const countryByUid = useMemo(() => new Map(b.geo.map((g) => [g.uid, countryFromAddress(g.address)?.country ?? ""])), [b.geo]);
  const countries = useMemo(() => { const m = new Map<string, number>(); countryByUid.forEach((c) => c && m.set(c, (m.get(c) ?? 0) + 1)); return [...m].sort((a, c) => c[1] - a[1]); }, [countryByUid]);
  // How many users each filter option would match on its own (so the admin sees sizes before clicking).
  const optionCounts = useMemo(() => Object.fromEntries(FACETS.map((f) => [f.key, Object.fromEntries(f.options.map((o) => [o.value, b.users.filter((x) => o.test(x, ctx)).length]))])), [b.users, ctx]);
  const sel = useMemo(() => Object.fromEntries(FACET_KEYS.map((k) => [k, u[k as keyof typeof u] as string])), [u]);
  const counts = useMemo(() => Object.fromEntries(USER_FILTERS.map((f) => [f.key, f.key === "all" ? b.users.length : b.users.filter((x) => matchesFilter(f.key, x, ctx)).length])), [b.users, ctx]);

  const geoActive = !!u.address || (!!u.lat && !!u.lng && !!u.radius);
  const rows = useMemo(() => {
    const q = u.q.trim().toLowerCase();
    const fromMs = u.from ? new Date(`${u.from}T00:00:00`).getTime() : 0;
    const toMs = u.to ? new Date(`${u.to}T00:00:00`).getTime() + 86_400_000 : Infinity;
    let r = b.users.filter((x) => matchesFilter(u.filter, x, ctx) && matchesFacets(x, ctx, sel) && x[3] >= fromMs && x[3] < toMs && (!u.country || countryByUid.get(x[0]) === u.country));
    if (q) r = r.filter((x) => x[1].toLowerCase().includes(q) || x[2].toLowerCase().includes(q) || x[0] === u.q.trim());
    if (geoActive) {
      const ok = new Set(b.geo
        .filter((g) => !u.address || g.address.toLowerCase().includes(u.address.toLowerCase()))
        .filter((g) => !(u.lat && u.lng && u.radius) || distanceKm({ lat: +u.lat, lng: +u.lng }, g) <= +u.radius)
        .map((g) => g.uid));
      r = r.filter((x) => ok.has(x[0]));
    }
    const cmp = SORTS[u.sort] ?? SORTS.created;
    const sign = u.dir === "asc" ? 1 : -1;
    return [...r].sort((a, c) => sign * cmp(a, c, petCount));
  }, [b, u.q, u.filter, u.sort, u.dir, u.address, u.lat, u.lng, u.radius, u.from, u.to, u.country, sel, countryByUid, geoActive, ctx, petCount]);

  const size = Number(u.size) || 25;
  const pageRows = paginate(rows, Number(u.page) || 1, size);
  const reset = (patch: Partial<typeof DEFAULTS>) => set({ ...patch, page: "1" });

  const pills: [string, string, () => void][] = [];
  if (u.filter !== "all") pills.push(["Filter", USER_FILTERS.find((f) => f.key === u.filter)?.label ?? u.filter, () => reset({ filter: "all" })]);
  if (u.q) pills.push(["Search", u.q, () => { setQDraft(""); reset({ q: "" }); }]);
  FACETS.forEach((f) => { const o = f.options.find((x) => x.value === sel[f.key]); if (o) pills.push([f.label, o.label, () => reset({ [f.key]: "" } as Partial<typeof DEFAULTS>)]); });
  if (u.country) pills.push(["Country", u.country, () => reset({ country: "" })]);
  if (u.from || u.to) pills.push(["Signed up", `${u.from || "…"} → ${u.to || "…"}`, () => reset({ from: "", to: "" })]);
  if (u.address) pills.push(["Address", u.address, () => reset({ address: "" })]);
  if (u.lat && u.lng && u.radius) pills.push(["Near", `${u.lat}, ${u.lng} · ${u.radius} km`, () => reset({ lat: "", lng: "", radius: "" })]);

  function exportCsv() {
    const esc = (v: string | number | boolean) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [["uid", "email", "name", "signed_up", "last_active", "pets", "used_a_feature", "sign_in", "email_verified", "profile_complete", "has_photo", "location_shared", "viewed_pet", "liked", "chatted", "requested", "posted", "push_device", "reported"],
      ...rows.map((x) => [x[0], x[1], x[2], new Date(x[3]).toISOString(), new Date(x[4]).toISOString(), petCount.get(x[0]) ?? 0, engaged.has(x[0]), METHOD_LABELS[x[7]], hasF(x, F.VERIFIED), (x[6] & PROFILE_BITS) === PROFILE_BITS, hasF(x, F.PHOTO), hasF(x, F.LOC), hasF(x, F.VIEWED), hasF(x, F.LIKED), hasF(x, F.CHATTED), hasF(x, F.REQUESTED), hasF(x, F.POSTED), hasF(x, F.PUSH), hasF(x, F.REPORTED)])];
    const url = URL.createObjectURL(new Blob([lines.map((l) => l.map(esc).join(",")).join("\n")], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: `petfinder-users-${new Date().toISOString().slice(0, 10)}.csv` }).click();
    URL.revokeObjectURL(url);
  }

  const th = (k: string, children: React.ReactNode) => {
    const on = u.sort === k;
    return (
      <th key={k} className="p-3 font-medium" aria-sort={on ? (u.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button className="inline-flex items-center gap-1 hover:text-fg" onClick={() => set({ sort: k, dir: on && u.dir === "desc" ? "asc" : "desc", page: "1" })}>
          {children}{on ? (u.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
        </button>
      </th>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form className="relative min-w-60 flex-1" onSubmit={(e) => { e.preventDefault(); reset({ q: qDraft.trim() }); }}>
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input className={`${input} pl-9`} placeholder="Search email, name or uid — press Enter" value={qDraft} onChange={(e) => setQDraft(e.target.value)} onBlur={() => qDraft.trim() !== u.q && reset({ q: qDraft.trim() })} />
        </form>
        <button className={btnGhost} onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen}><Filter className="h-4 w-4" />Filters{pills.filter((p) => p[0] !== "Search" && p[0] !== "Filter").length ? ` (${pills.filter((p) => p[0] !== "Search" && p[0] !== "Filter").length})` : ""}</button>
        <button className={btnGhost} onClick={() => setMoreOpen(!moreOpen)} aria-expanded={moreOpen}><SlidersHorizontal className="h-4 w-4" />Location</button>
        <button className={btnGhost} onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4" />Export {rows.length.toLocaleString()}</button>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {USER_FILTERS.map((f) => <Chip key={f.key} active={u.filter === f.key} count={counts[f.key]} onClick={() => reset({ filter: f.key })}>{f.label}</Chip>)}
      </div>

      {filtersOpen && (
        <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
          <div>
            <div className="mb-2 text-xs font-medium text-muted">Quick lists</div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => <button key={p.label} title={p.hint} className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm hover:border-accent hover:text-accent" onClick={() => reset({ ...Object.fromEntries(FACET_KEYS.map((k) => [k, ""])), ...p.set, filter: "all", country: "", from: "", to: "" } as Partial<typeof DEFAULTS>)}>{p.label}</button>)}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {FACETS.map((f) => (
              <div key={f.key}>
                <div className="mb-1.5 text-xs font-medium text-muted">{f.label}{f.hint ? <span className="ml-1 font-normal">· {f.hint}</span> : null}</div>
                <div className="flex flex-wrap gap-1.5">
                  <Chip active={!sel[f.key]} onClick={() => reset({ [f.key]: "" } as Partial<typeof DEFAULTS>)}>Any</Chip>
                  {f.options.map((o) => <Chip key={o.value} active={sel[f.key] === o.value} count={optionCounts[f.key][o.value]} onClick={() => reset({ [f.key]: sel[f.key] === o.value ? "" : o.value } as Partial<typeof DEFAULTS>)}>{o.label}</Chip>)}
                </div>
              </div>
            ))}
            <div>
              <div className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted"><MapPin className="h-3 w-3" />Country <span className="font-normal">· only users who shared a location</span></div>
              <select className={input} value={u.country} onChange={(e) => reset({ country: e.target.value })}>
                <option value="">Any country</option>
                {countries.map(([c, n]) => <option key={c} value={c}>{c} ({n})</option>)}
              </select>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted">Signed up between</div>
              <div className="flex items-center gap-2"><input type="date" className={input} value={u.from} max={u.to || undefined} onChange={(e) => reset({ from: e.target.value })} /><span className="text-muted">→</span><input type="date" className={input} value={u.to} min={u.from || undefined} onChange={(e) => reset({ to: e.target.value })} /></div>
            </div>
          </div>
          <p className="text-xs text-muted">Filters combine (a user must match every one). The number on each chip is how many users match that option alone. “Last active” is approximate (last sign-in or token refresh).</p>
        </div>
      )}

      {moreOpen && (
        <div className="grid gap-2 rounded-xl border border-border bg-surface p-3 md:grid-cols-4">
          <p className="text-xs text-muted md:col-span-4">Only <b>{b.geo.length}</b> of {b.users.length.toLocaleString()} users have a stored location, so these filters match that small group.</p>
          <input className={input} placeholder="Address contains…" value={u.address} onChange={(e) => reset({ address: e.target.value })} />
          <input className={input} placeholder="Near latitude" inputMode="decimal" value={u.lat} onChange={(e) => reset({ lat: e.target.value })} />
          <input className={input} placeholder="Near longitude" inputMode="decimal" value={u.lng} onChange={(e) => reset({ lng: e.target.value })} />
          <input className={input} placeholder="Radius (km)" inputMode="decimal" value={u.radius} onChange={(e) => reset({ radius: e.target.value })} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium tabular-nums">{rows.length.toLocaleString()} users</span>
        {pills.map(([k, v, rm]) => (
          <span key={k} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pl-3 pr-1.5 text-xs"><span className="text-muted">{k}:</span> {v}
            <button onClick={rm} aria-label={`Remove ${k} filter`} className="rounded-full p-0.5 hover:bg-border"><X className="h-3 w-3" /></button></span>
        ))}
        {pills.length > 1 && <button className="text-xs text-accent underline" onClick={() => { setQDraft(""); set({ ...DEFAULTS, size: u.size }); }}>Clear all</button>}
      </div>

      {rows.length === 0 ? <Empty action={<button className={btnPrimary} onClick={() => { setQDraft(""); set({ ...DEFAULTS, size: u.size }); }}>Clear filters</button>}>No users match these filters.</Empty> : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-surface md:block">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface-2 text-xs text-muted">
                <tr>{th("name", "User")}{th("created", "Signed up")}{th("lastSeen", "Last active")}{th("pets", "Pets")}<th className="p-3 font-medium">Sign-in</th><th className="p-3 font-medium">Profile</th><th className="p-3 font-medium">Address</th><th className="p-3 font-medium">Status</th></tr>
              </thead>
              <tbody>
                {pageRows.map((x) => (
                  <tr key={x[0]} onClick={() => setOpenUid(x[0])} className="cursor-pointer border-t border-border hover:bg-surface-2">
                    <td className="p-3"><div className="flex items-center gap-3"><Avatar name={x[2] || x[1]} /><div className="min-w-0"><div className="truncate font-medium">{x[2] || "—"}</div><div className="truncate text-xs text-muted">{x[1] || x[0]}</div></div></div></td>
                    <td className="whitespace-nowrap p-3 text-muted">{fmtDay(x[3])}</td>
                    <td className="whitespace-nowrap p-3 text-muted">{ago(x[4])}</td>
                    <td className="p-3 tabular-nums">{petCount.get(x[0]) ?? 0}</td>
                    <td className="p-3 text-muted">{METHOD_LABELS[x[7]]}</td>
                    <td className="p-3">{(x[6] & PROFILE_BITS) === PROFILE_BITS ? <Badge tone="success">Complete</Badge> : <Badge tone="warn">{!hasF(x, F.PHOTO) ? "No photo" : "Incomplete"}</Badge>}</td>
                    <td className="max-w-52 truncate p-3 text-muted">{geoByUid.get(x[0])?.address || "—"}</td>
                    <td className="p-3">{x[5] ? <Badge tone="danger">Disabled</Badge> : engaged.has(x[0]) ? <Badge tone="success">Engaged</Badge> : <Badge tone="warn">No activity</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 md:hidden">
            {pageRows.map((x) => (
              <li key={x[0]}><button onClick={() => setOpenUid(x[0])} className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left">
                <Avatar name={x[2] || x[1]} /><div className="min-w-0 flex-1"><div className="truncate font-medium">{x[2] || x[1]}</div><div className="truncate text-xs text-muted">{x[2] ? x[1] + " · " : ""}joined {fmtDay(x[3])} · {ago(x[4])}</div></div>
                {engaged.has(x[0]) ? <Badge tone="success">Engaged</Badge> : <Badge tone="warn">None</Badge>}</button></li>
            ))}
          </ul>
          <Pagination page={Number(u.page) || 1} size={size} total={rows.length} onPage={(p) => set({ page: String(p) })} onSize={(s) => set({ size: String(s), page: "1" })} />
        </>
      )}

      <Drawer open={!!openUid} onClose={() => setOpenUid(null)} title="User">
        {openUid && <UserQuickView uid={openUid} base={b.users.find((x) => x[0] === openUid)} />}
      </Drawer>
    </div>
  );
}

export default function UsersPage() {
  return (
    <>
      <PageHeader title="Users" sub="Search, filter and export. Everything here runs on the cached data, with no API calls." actions={<DataStatus />} />
      <Suspense fallback={<Spinner />}><BundleGate>{(b) => <Body b={b} />}</BundleGate></Suspense>
    </>
  );
}
