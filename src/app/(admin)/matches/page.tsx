"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Empty, ErrorBox, Spinner, btnDanger, btnGhost, btnPrimary, input } from "@/components/ui";
import { ApiError, api, fmtMs } from "@/lib/api";

interface PickedUser { uid: string; email: string; name: string }
interface Pet { id: string; name: string; category: string; ownerName: string; ownerEmail: string }
interface Recent {
  adoptionRequests: { id: string; status: string; at: number | null; from: string; owner: string; petId: string }[];
  chats: { id: string; at: number | null; petId: string; people: string[] }[];
}

function UserPicker({ label, value, onPick }: { label: string; value: PickedUser | null; onPick: (u: PickedUser | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedUser[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.trim().length < 3) { setResults([]); return; } // eslint-disable-line react-hooks/set-state-in-effect
    const t = setTimeout(() => {
      setBusy(true);
      api<{ users: PickedUser[] }>(`/api/admin/users?q=${encodeURIComponent(q.trim())}`)
        .then((r) => setResults(r.users.slice(0, 8)))
        .catch(() => setResults([]))
        .finally(() => setBusy(false));
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  if (value)
    return (
      <div className="space-y-1">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
          <span className="min-w-0 truncate">{value.name || "(no name)"} <span className="text-xs text-slate-500">{value.email}</span></span>
          <button type="button" className="ml-2 text-xs underline" onClick={() => onPick(null)}>Change</button>
        </div>
      </div>
    );
  return (
    <div className="relative space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input className={input} placeholder="Search email or name (3+ characters)" value={q} onChange={(e) => setQ(e.target.value)} />
      {(busy || results.length > 0) && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {busy && <li className="p-2 text-xs text-slate-500">Searching…</li>}
          {results.map((u) => (
            <li key={u.uid}><button type="button" className="w-full p-2 text-left text-sm hover:bg-slate-50" onClick={() => { onPick(u); setQ(""); setResults([]); }}>{u.name || "(no name)"} <span className="text-xs text-slate-500">{u.email}</span></button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MatchesInner() {
  const sp = useSearchParams();
  const [a, setA] = useState<PickedUser | null>(null);
  const [b, setB] = useState<PickedUser | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [petId, setPetId] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [recent, setRecent] = useState<Recent | null>(null);
  const [recentErr, setRecentErr] = useState<string | null>(null);

  const loadRecent = () => api<Recent>("/api/admin/matches").then(setRecent).catch((e) => setRecentErr(`Failed to load recent activity: ${(e as Error).message}`));
   
  useEffect(() => { loadRecent(); }, []);

  useEffect(() => {
    const uid = sp.get("a");
    if (uid) api<PickedUser>(`/api/admin/users/${uid}`).then((u) => setA({ uid, email: u.email, name: u.name })).catch(() => {});
  }, [sp]);

  useEffect(() => {
    const ids = [a?.uid, b?.uid].filter(Boolean) as string[];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPetId("");
    if (!ids.length) { setPets([]); return; }  
    Promise.all(ids.map((id) => api<{ pets: Pet[] }>(`/api/admin/pets?owner=${encodeURIComponent(id)}`).then((r) => r.pets)))
      .then((l) => setPets(l.flat()))
      .catch((e) => setError(`Failed to load pets: ${(e as Error).message}`));
  }, [a?.uid, b?.uid]);

  async function submit() {
    if (!a || !b || !petId) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await api<{ chatId: string; push: { devices: number; sent: number; failed: number } }>("/api/admin/matches", {
        method: "POST",
        body: JSON.stringify({ userA: a.uid, userB: b.uid, petId, message }),
      });
      setResult(`Connection created (chat ${r.chatId}). Push: ${r.push.sent}/${r.push.devices} devices notified${r.push.failed ? `, ${r.push.failed} failed` : ""}.`);
      setConfirming(false); setA(null); setB(null); setMessage("");
      loadRecent();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? `${e.message} (chat ${e.data.chatId})` : `Could not create the connection: ${(e as Error).message}`);
      setConfirming(false);
    } finally { setBusy(false); }
  }

  const ready = a && b && petId && a.uid !== b.uid;
  const petLabel = pets.find((p) => p.id === petId)?.name;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Connect users</h1>
        <p className="text-sm text-slate-500">Creates a chat between two users about a pet, posts a first message from the official account, and sends a push notification to both. This writes to the live app.</p>
      </div>

      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
        <UserPicker label="User A" value={a} onPick={setA} />
        <UserPicker label="User B" value={b} onPick={setB} />
        <label className="space-y-1 md:col-span-2">
          <span className="text-sm font-medium">Pet the chat is about</span>
          <select className={input} value={petId} onChange={(e) => setPetId(e.target.value)} disabled={!pets.length}>
            <option value="">{pets.length ? "Select a pet…" : "Pick a user who owns pets first"}</option>
            {pets.map((p) => <option key={p.id} value={p.id}>{p.name || "(unnamed)"} · {p.category} · owner {p.ownerName || p.ownerEmail}</option>)}
          </select>
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className="text-sm font-medium">First message (optional)</span>
          <textarea className={`${input} min-h-20`} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="You have been connected by the PetFinder team. Say hello!" />
        </label>
        {a && b && a.uid === b.uid && <div className="md:col-span-2"><ErrorBox message="Choose two different users." /></div>}
        {error && <div className="md:col-span-2"><ErrorBox message={error} /></div>}
        {result && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 md:col-span-2">{result}</div>}
        <div className="md:col-span-2"><button className={btnPrimary} disabled={!ready} onClick={() => setConfirming(true)}>Connect &amp; notify…</button></div>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">Recent adoption requests</h2>
        {recentErr && <ErrorBox message={recentErr} />}
        {!recent && !recentErr && <Spinner />}
        {recent?.adoptionRequests.length === 0 && <Empty>None.</Empty>}
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
          {recent?.adoptionRequests.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 p-3"><span>{r.from} → {r.owner}</span><span className="text-slate-500">{r.status} · {fmtMs(r.at)}</span></li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Recent chats</h2>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
          {recent?.chats.map((c) => (
            <li key={c.id} className="flex flex-wrap justify-between gap-2 p-3"><span>{c.people.join(" ↔ ")}</span><span className="text-slate-500">{fmtMs(c.at)}</span></li>
          ))}
        </ul>
        <Link href="/users" className="text-sm underline">Browse users</Link>
      </section>

      {confirming && a && b && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5">
            <h3 className="font-semibold">Connect these users?</h3>
            <p className="text-sm text-slate-600">{a.name || a.email} ↔ {b.name || b.email} about <b>{petLabel}</b>. A real chat is created and both users get a push notification.</p>
            <div className="flex justify-end gap-3">
              <button className={btnGhost} onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
              <button className={btnDanger} onClick={submit} disabled={busy}>{busy ? "Sending…" : "Connect & notify"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MatchesPage() {
  return <Suspense fallback={<Spinner />}><MatchesInner /></Suspense>;
}
