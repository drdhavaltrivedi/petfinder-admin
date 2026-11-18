"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Stat } from "@/components/charts";
import { Avatar, ErrorBox, Spinner, btnPrimary } from "@/components/ui";
import { api, fmtMs } from "@/lib/api";

interface Detail {
  uid: string; email: string; name: string; photo: string; address: string; gender: string; favoritePet: string;
  location: { lat: number; lng: number } | null; created: number | null; lastSignIn: number | null; lastRefresh: number | null;
  disabled: boolean; providers: string[]; reportCount: number;
  counts: { likes: number; chats: number; pushTokens: number };
  pets: { id: string; name: string; category: string; status: string; photo: string }[];
  adoptionRequests: { id: string; direction: string; status: string; at: number | null; petId: string }[];
}

export default function UserDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const [u, setU] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Detail>(`/api/admin/users/${uid}`).then(setU).catch((e) => setError(`Failed to load user: ${(e as Error).message}`));
  }, [uid]);

  if (error) return <ErrorBox message={error} />;
  if (!u) return <Spinner />;

  return (
    <div className="space-y-6">
      <Link href="/users" className="text-sm text-slate-500 hover:underline">← All users</Link>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar url={u.photo} name={u.name || u.email} />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{u.name || "(no name)"}</h1>
          <div className="text-sm text-slate-500">{u.email} · <span className="font-mono text-xs">{u.uid}</span></div>
        </div>
        <Link href={`/matches?a=${u.uid}`} className={`${btnPrimary} ml-auto`}>Connect with another user</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Pets listed" value={u.pets.length} />
        <Stat label="Likes given" value={u.counts.likes} />
        <Stat label="Chats" value={u.counts.chats} />
        <Stat label="Push devices" value={u.counts.pushTokens} />
      </div>

      <dl className="grid gap-x-8 gap-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm md:grid-cols-2">
        <div><dt className="text-xs text-slate-500">Signed up</dt><dd>{fmtMs(u.created)}</dd></div>
        <div><dt className="text-xs text-slate-500">Last sign-in</dt><dd>{fmtMs(u.lastSignIn)}</dd></div>
        <div><dt className="text-xs text-slate-500">Last token refresh (≈ last active)</dt><dd>{fmtMs(u.lastRefresh)}</dd></div>
        <div><dt className="text-xs text-slate-500">Sign-in methods</dt><dd>{u.providers.join(", ") || "—"}</dd></div>
        <div><dt className="text-xs text-slate-500">Address</dt><dd>{u.address || "—"}</dd></div>
        <div><dt className="text-xs text-slate-500">Location</dt><dd>{u.location ? `${u.location.lat.toFixed(4)}, ${u.location.lng.toFixed(4)}` : "—"}</dd></div>
        <div><dt className="text-xs text-slate-500">Gender / favourite pet</dt><dd>{u.gender || "—"} / {u.favoritePet || "—"}</dd></div>
        <div><dt className="text-xs text-slate-500">Reports against user</dt><dd>{u.reportCount}{u.disabled && " · account disabled"}</dd></div>
      </dl>

      <section>
        <h2 className="mb-2 font-semibold">Pets ({u.pets.length})</h2>
        {u.pets.length === 0 ? <p className="text-sm text-slate-500">No pets listed.</p> : (
          <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {u.pets.map((p) => (
              <li key={p.id} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.photo ? <img src={p.photo} alt="" className="h-14 w-14 rounded-lg object-cover" /> : <div className="h-14 w-14 rounded-lg bg-slate-200" />}
                <div className="text-sm"><div className="font-medium">{p.name || "(unnamed)"}</div><div className="text-xs capitalize text-slate-500">{p.category} · {p.status}</div></div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Adoption requests ({u.adoptionRequests.length})</h2>
        {u.adoptionRequests.length === 0 ? <p className="text-sm text-slate-500">None.</p> : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
            {u.adoptionRequests.map((r) => (
              <li key={r.id} className="flex justify-between p-3"><span className="capitalize">{r.direction} · {r.status}</span><span className="text-slate-500">{fmtMs(r.at)}</span></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
