"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useState, type ReactNode } from "react";

export function Delta({ now, prev }: { now: number; prev: number }) {
  if (!prev) return null;
  const p = ((now - prev) / prev) * 100;
  const up = p >= 0;
  return (
    <span className={`inline-flex items-center text-xs font-medium ${up ? "text-success" : "text-danger"}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(p).toFixed(0)}%<span className="ml-1 font-normal text-muted">vs previous</span>
    </span>
  );
}

export function Stat({ label, value, hint, tone, icon, children }: {
  label: string; value: number | string; hint?: ReactNode; tone?: "warn"; icon?: ReactNode; children?: ReactNode;
}) {
  return (
    <div className={`h-full rounded-xl border p-4 ${tone === "warn" ? "border-warn/40 bg-warn/10" : "border-border bg-surface"}`}>
      <div className="flex items-center gap-2 text-xs text-muted">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
      {children}
    </div>
  );
}

export function Card({ title, children, note, action }: { title: string; children: ReactNode; note?: string; action?: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
      {note && <p className="mt-3 text-xs text-muted">{note}</p>}
    </section>
  );
}

/** Area/line chart with hover tooltip. */
export function AreaChart({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600, H = 150, P = 6;
  const max = Math.max(1, ...data.map((d) => d.value));
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, data.length - 1);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${H - P} L${x(0)},${H - P} Z`;
  const h = hover !== null ? data[hover] : null;
  return (
    <figure aria-label={label} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.round(((e.clientX - r.left) / r.width) * (data.length - 1)));
        }}>
        <path d={area} fill="var(--accent)" opacity="0.12" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={P} y2={H - P} stroke="var(--muted)" strokeDasharray="3" vectorEffect="non-scaling-stroke" />}
      </svg>
      {h && hover !== null && (
        <div className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-border bg-surface px-2 py-1 text-xs shadow"
          style={{ left: `${(x(hover) / W) * 100}%` }}>
          <div className="text-muted">{h.label}</div><div className="font-semibold tabular-nums">{h.value.toLocaleString()}</div>
        </div>
      )}
      <figcaption className="mt-1 flex justify-between text-[11px] text-muted"><span>{data[0]?.label}</span><span>peak {max.toLocaleString()}</span><span>{data[data.length - 1]?.label}</span></figcaption>
    </figure>
  );
}

export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ul className="space-y-2">
      {steps.map((s, i) => (
        <li key={s.label}>
          <div className="mb-1 flex justify-between text-sm"><span>{s.label}</span>
            <span className="tabular-nums text-muted">{s.value.toLocaleString()} · {((s.value / top) * 100).toFixed(1)}%{i > 0 && steps[i - 1].value ? ` (${((s.value / steps[i - 1].value) * 100).toFixed(0)}% of prev)` : ""}</span></div>
          <div className="h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full bg-accent" style={{ width: `${Math.max(0.5, (s.value / top) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
