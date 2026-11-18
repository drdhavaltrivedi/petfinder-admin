"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BundleGate, DataStatus } from "@/components/DataStatus";
import { useToast } from "@/components/toast";
import { Empty, ErrorBox, PageHeader, Skeleton, Spinner, btnDanger, btnGhost, btnPrimary, input } from "@/components/ui";
import { ApiError, api, fmtMs } from "@/lib/api";
import { invalidate, useApi } from "@/lib/query";
import type { Bundle } from "@/lib/shared";

interface Picked { uid: string; email: string; name: string }
interface Recent {
  adoptionRequests: { id: string; status: string; at: number | null; from: string; owner: string; petId: string }[];
  chats: { id: string; at: number | null; petId: string; people: string[] }[];
}

/** Searches the cached user list in the browser: no API call per keystroke. */
function UserPicker({ label, value, onPick, b }: { label: string; value: Picked | null; onPick: (u: Picked | null) => void; b: Bundle }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 3) return [];
    const out: Picked[] = [];
    for (const u of b.users) { if (u[1].toLowerCase().includes(t) || u[2].toLowerCase().includes(t)) { out.push({ uid: u[0], email: u[1], name: u[2] }); if (out.length >= 8) break; } }
    return out;
  }, [q, b.users]);

  if (value)
    return (
      <div className="space-y-1"><span className="text-sm font-medium">{label}</span>
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
          <span className="min-w-0 truncate">{value.name || "(no name)"} <span className="text-xs text-muted">{value.email}</span></span>
          <button type="button" className="ml-2 text-xs underline" onClick={() => onPick(null)}>Change</button></div></div>
    );
  return (
    <div className="relative space-y-1"><span className="text-sm font-medium">{label}</span>
      <input className={input} placeholder="Search email or name (3+ characters)" value={q} onChange={(e) => setQ(e.target.value)} />
      {results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-surface shadow-lg">
          {results.map((u) => <li key={u.uid}><button type="button" className="w-full p-2 text-left text-sm hover:bg-surface-2" onClick={() => { onPick(u); setQ(""); }}>{u.name || "(no name)"} <span className="text-xs text-muted">{u.email}</span></button></li>)}
        </ul>)}
    </div>
  );
}

function Body({ b }: { b: Bundle }) {
  const sp = useSearchParams();
  const toast = useToast();
  const [a, setA] = useState<Picked | null>(null);
  const [c, setC] = useState<Picked | null>(null);
  const [petId, setPetId] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recent = useApi<Recent>("/api/admin/matches", 60_000);

  useEffect(() => {
    const uid = sp.get("a");
    const u = uid && b.users.find((x) => x[0] === uid);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (u) setA({ uid: u[0], email: u[1], name: u[2] });
  }, [sp, b.users]);

  const owners = useMemo(() => new Map(b.users.map((x) => [x[0], x])), [b.users]);
  const pets = useMemo(() => b.pets.filter((p) => p.owner === a?.uid || p.owner === c?.uid), [b.pets, a, c]);
  const ready = a && c && petId && a.uid !== c.uid;
  const petName = pets.find((p) => p.id === petId)?.name;

  async function submit() {
    if (!a || !c || !petId) return;
    setBusy(true); setError(null);
    try {
      const r = await api<{ chatId: string; push: { devices: number; sent: number; failed: number } }>("/api/admin/matches", { method: "POST", body: JSON.stringify({ userA: a.uid, userB: c.uid, petId, message }) });
      toast("ok", `Connected. Push sent to ${r.push.sent}/${r.push.devices} devices${r.push.failed ? ` (${r.push.failed} failed)` : ""}.`);
      setConfirming(false); setA(null); setC(null); setPetId(""); setMessage("");
      invalidate("/api/admin/matches"); recent.reload();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? `${e.message} (chat ${e.data.chatId})` : `Could not create the connection: ${(e as Error).message}`);
      setConfirming(false);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 rounded-xl border border-border bg-surface p-4 md:grid-cols-2">
        <UserPicker label="User A" value={a} onPick={(u) => { setA(u); setPetId(""); }} b={b} />
        <UserPicker label="User B" value={c} onPick={(u) => { setC(u); setPetId(""); }} b={b} />
        <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium">Pet the chat is about</span>
          <select className={input} value={petId} onChange={(e) => setPetId(e.target.value)} disabled={!pets.length}>
            <option value="">{pets.length ? "Select a pet…" : "Pick a user who owns pets first"}</option>
            {pets.map((p) => <option key={p.id} value={p.id}>{p.name || "(unnamed)"} · {p.category} · owner {owners.get(p.owner)?.[2] || owners.get(p.owner)?.[1]}</option>)}
          </select></label>
        <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium">First message (optional)</span>
          <textarea className={`${input} min-h-20`} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="You have been connected by the PetFinder team. Say hello!" /></label>
        {a && c && a.uid === c.uid && <div className="md:col-span-2"><ErrorBox message="Choose two different users." /></div>}
        {error && <div className="md:col-span-2"><ErrorBox message={error} /></div>}
        <div className="md:col-span-2"><button className={btnPrimary} disabled={!ready} onClick={() => setConfirming(true)}>Connect &amp; notify…</button></div>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">Recent adoption requests</h2>
        {recent.error && <ErrorBox message={`Failed to load recent activity: ${recent.error}`} onRetry={recent.reload} />}
        {!recent.data && !recent.error && <Skeleton className="h-32" />}
        {recent.data?.adoptionRequests.length === 0 && <Empty>None.</Empty>}
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface text-sm">
          {recent.data?.adoptionRequests.map((r) => <li key={r.id} className="flex flex-wrap justify-between gap-2 p-3"><span>{r.from} → {r.owner}</span><span className="text-muted">{r.status} · {fmtMs(r.at)}</span></li>)}
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">Recent chats</h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface text-sm">
          {recent.data?.chats.map((ch) => <li key={ch.id} className="flex flex-wrap justify-between gap-2 p-3"><span>{ch.people.join(" ↔ ")}</span><span className="text-muted">{fmtMs(ch.at)}</span></li>)}
        </ul>
        <Link href="/users" className="text-sm text-accent underline">Browse users</Link>
      </section>

      {confirming && a && c && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-surface p-5">
            <h3 className="font-semibold">Connect these users?</h3>
            <p className="text-sm text-muted">{a.name || a.email} ↔ {c.name || c.email} about <b className="text-fg">{petName}</b>. A real chat is created and both users get a push notification.</p>
            <div className="flex justify-end gap-3"><button className={btnGhost} onClick={() => setConfirming(false)} disabled={busy}>Cancel</button><button className={btnDanger} onClick={submit} disabled={busy}>{busy ? "Sending…" : "Connect & notify"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MatchesPage() {
  return (
    <>
      <PageHeader title="Connect users" sub="Creates a chat about a pet, posts a first message from the official account and sends a push to both users. This writes to the live app." actions={<DataStatus />} />
      <Suspense fallback={<Spinner />}><BundleGate>{(b) => <Body b={b} />}</BundleGate></Suspense>
    </>
  );
}
