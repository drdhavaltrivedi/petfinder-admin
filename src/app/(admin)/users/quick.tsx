"use client";

import Link from "next/link";
import { Skeleton, ErrorBox, Avatar, Badge, btnPrimary, btnGhost } from "@/components/ui";
import { ago, fmtMs } from "@/lib/api";
import { useBundle } from "@/lib/bundle";
import { useApi } from "@/lib/query";
import type { UserTuple } from "@/lib/shared";

export interface Detail {
  uid: string; email: string; name: string; photo: string; address: string; gender: string; favoritePet: string;
  location: { lat: number; lng: number } | null; created: number | null; lastSignIn: number | null; lastRefresh: number | null;
  disabled: boolean; providers: string[]; reportCount: number;
  counts: { likes: number; chats: number; pushTokens: number };
  pets: { id: string; name: string; category: string; status: string; photo: string }[];
  adoptionRequests: { id: string; direction: string; status: string; at: number | null; petId: string }[];
}

/** Side-drawer preview: instant header from the cached bundle, details fetched live (and cached 5 min). */
export function UserQuickView({ uid, base }: { uid: string; base?: UserTuple }) {
  const { engaged, petCount } = useBundle();
  const { data: d, error, reload } = useApi<Detail>(`/api/admin/users/${uid}`);
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Avatar url={d?.photo} name={d?.name || base?.[2] || base?.[1]} size={48} />
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold">{d?.name || base?.[2] || "(no name)"}</div>
          <div className="truncate text-sm text-muted">{d?.email || base?.[1]}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {engaged.has(uid) ? <Badge tone="success">Engaged</Badge> : <Badge tone="warn">No activity</Badge>}
        {base?.[5] ? <Badge tone="danger">Disabled</Badge> : null}
        <Badge>{petCount.get(uid) ?? 0} pets</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-xs text-muted">Signed up</dt><dd>{fmtMs(base?.[3] ?? d?.created)}</dd></div>
        <div><dt className="text-xs text-muted">Last active</dt><dd>{base ? ago(base[4]) : "—"}</dd></div>
        {error && <div className="col-span-2"><ErrorBox message={`Could not load details: ${error}`} onRetry={reload} /></div>}
        {!d && !error && <><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="col-span-2 h-16" /></>}
        {d && <>
          <div><dt className="text-xs text-muted">Likes given</dt><dd>{d.counts.likes}</dd></div>
          <div><dt className="text-xs text-muted">Chats</dt><dd>{d.counts.chats}</dd></div>
          <div><dt className="text-xs text-muted">Push devices</dt><dd>{d.counts.pushTokens}</dd></div>
          <div><dt className="text-xs text-muted">Sign-in</dt><dd>{d.providers.join(", ") || "—"}</dd></div>
          <div className="col-span-2"><dt className="text-xs text-muted">Address</dt><dd>{d.address || "—"}</dd></div>
        </>}
      </dl>
      {d && d.pets.length > 0 && (
        <div><div className="mb-2 text-xs text-muted">Pets</div>
          <ul className="space-y-2">{d.pets.map((p) => <li key={p.id} className="flex items-center gap-3 rounded-lg border border-border p-2 text-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.photo ? <img src={p.photo} alt="" className="h-10 w-10 rounded-md object-cover" /> : <div className="h-10 w-10 rounded-md bg-surface-2" />}
            <div><div className="font-medium">{p.name || "(unnamed)"}</div><div className="text-xs capitalize text-muted">{p.category} · {p.status}</div></div></li>)}</ul></div>
      )}
      <div className="flex gap-2">
        <Link href={`/users/${uid}`} className={btnPrimary}>Full profile</Link>
        <Link href={`/matches?a=${uid}`} className={btnGhost}>Connect…</Link>
      </div>
    </div>
  );
}
