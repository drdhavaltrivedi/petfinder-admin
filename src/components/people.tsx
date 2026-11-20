import Link from "next/link";
import type { Person } from "@/lib/insightTypes";

export const personLabel = (p: Person) => p.name || p.email || p.uid;

export function PersonLink({ p }: { p: Person }) {
  return <Link href={`/users/${p.uid}`} className="hover:underline" title={p.email}>{personLabel(p)}{p.name && p.email ? <span className="ml-1 text-xs text-muted">{p.email}</span> : null}</Link>;
}

export function Thumb({ url, size = 48 }: { url?: string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" loading="lazy" style={{ width: size, height: size }} className="shrink-0 rounded-lg bg-surface-2 object-cover" /> : <div style={{ width: size, height: size }} className="shrink-0 rounded-lg bg-surface-2" />;
}

export const Section = ({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) => (
  <section><h2 className="mb-2 font-semibold">{title}{count !== undefined ? ` (${count})` : ""}</h2>{children}</section>
);
export const None = ({ children = "None." }: { children?: React.ReactNode }) => <p className="text-sm text-muted">{children}</p>;
export const statusTone = (s: string) => (s === "Approved" || s === "Active" || s === "Resolved" ? "success" : s === "Rejected" || s === "Deactivated" ? "danger" : s === "Pending" ? "warn" : "neutral") as "success" | "danger" | "warn" | "neutral";
