"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PersonLink } from "@/components/people";
import { Badge, ErrorBox, PageHeader, Skeleton } from "@/components/ui";
import { fmtMs } from "@/lib/api";
import type { Person } from "@/lib/insightTypes";
import { useApi } from "@/lib/query";

interface Chat {
  id: string; createdAt: number | null; updatedAt: number | null; truncated: boolean;
  pet: { id: string; name: string; category: string } | null; participants: Person[];
  messages: { id: string; at: number | null; type: string; text: string; image: string; read: boolean; sender: Person }[];
}

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const { data: c, error, reload } = useApi<Chat>(`/api/admin/chats/${id}`);
  if (error) return <ErrorBox message={`Failed to load chat: ${error}`} onRetry={reload} />;
  if (!c) return <div className="space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;
  const [first] = c.participants;
  return (
    <div className="space-y-5">
      <Link href="#" onClick={(e) => { e.preventDefault(); history.back(); }} className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" />Back</Link>
      <PageHeader
        title="Chat"
        sub={<>{c.participants.map((p, i) => <span key={p.uid}>{i > 0 && " ↔ "}<PersonLink p={p} /></span>)}{c.pet && <> · about <Link className="underline" href={`/pets/${c.pet.id}`}>{c.pet.name || "a pet"}</Link></>}</>}
        actions={<><Badge>{c.messages.length}{c.truncated ? "+" : ""} messages</Badge><span className="text-xs text-muted">Started {fmtMs(c.createdAt)}</span></>}
      />
      <p className="rounded-lg border border-warn/40 bg-warn/10 p-3 text-xs">Private conversation. Opening it is recorded in the server log with your admin ID. Only open chats when you need to (a report, a safety concern).</p>
      {c.truncated && <p className="text-xs text-muted">Showing the first 500 messages.</p>}
      <ul className="space-y-2">
        {c.messages.length === 0 && <li className="text-sm text-muted">No messages.</li>}
        {c.messages.map((m) => {
          const mine = m.sender.uid === first?.uid;
          return (
            <li key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-surface-2" : "bg-accent/15"}`}>
                <div className="mb-0.5 text-xs text-muted">{m.sender.name || m.sender.email || m.sender.uid} · {fmtMs(m.at)}</div>
                {m.type === "Image" && m.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.image} alt="" className="mb-1 max-h-60 rounded-lg" />
                )}
                {m.text && <div className="whitespace-pre-wrap break-words">{m.text}</div>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
