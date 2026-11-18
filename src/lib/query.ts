"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

// In-memory stale-while-revalidate cache for the few live endpoints (user detail, recent matches).
const store = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export function invalidate(prefix: string) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}

export function useApi<T>(path: string | null, ttlMs = 5 * 60_000) {
  const [data, setData] = useState<T | null>(() => (path ? ((store.get(path)?.data as T) ?? null) : null));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path && !store.has(path));
  const seq = useRef(0);

  const run = useCallback(async (force: boolean) => {
    if (!path) return;
    const id = ++seq.current;
    const hit = store.get(path);
    if (hit && !force && Date.now() - hit.at < ttlMs) { setData(hit.data as T); setLoading(false); return; }
    if (hit) setData(hit.data as T); // show stale instantly
    else setLoading(true);
    setError(null);
    try {
      let p = inflight.get(path) as Promise<T> | undefined;
      if (!p) { p = api<T>(path + (force ? (path.includes("?") ? "&fresh=1" : "?fresh=1") : "")); inflight.set(path, p); }
      const d = await p;
      store.set(path, { at: Date.now(), data: d });
      if (id === seq.current) setData(d);
    } catch (e) {
      if (id === seq.current) setError((e as Error).message);
    } finally {
      inflight.delete(path);
      if (id === seq.current) setLoading(false);
    }
  }, [path, ttlMs]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { run(false); }, [run]);
  return { data, error, loading, reload: () => run(true) };
}
