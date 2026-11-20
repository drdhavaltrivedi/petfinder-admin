"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import { idbClear, idbGet, idbSet } from "./idb";
import { useAuth } from "./auth";
import type { Bundle } from "./shared";

export const BUNDLE_TTL = 48 * 3_600_000;

interface Ctx {
  bundle: Bundle | null;
  error: string | null;
  loading: boolean; // first load, nothing to show yet
  refreshing: boolean;
  refresh: () => Promise<void>;
  petCount: Map<string, number>;
  engaged: Set<string>;
}
const BundleCtx = createContext<Ctx | null>(null);

export function BundleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const inflight = useRef(false);

  const fetchBundle = useCallback(async (force: boolean) => {
    if (!uid || inflight.current) return;
    inflight.current = true;
    setRefreshing(true);
    setError(null);
    try {
      const b = await api<Bundle>(`/api/admin/bundle${force ? "?refresh=1" : ""}`);
      setBundle(b);
      await idbSet(`bundle:${uid}`, b);
    } catch (e) {
      setError(`Failed to load data: ${(e as Error).message}`);
    } finally {
      inflight.current = false;
      setRefreshing(false);
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    let live = true;
    (async () => {
      const cached = await idbGet<Bundle>(`bundle:${uid}`);
      if (!live) return;
      if (cached?.v === 2) {
        setBundle(cached);
        setLoading(false);
        if (Date.now() - cached.generatedAt > BUNDLE_TTL) fetchBundle(false); // expired: refresh in background
      } else {
        fetchBundle(false);
      }
    })();
    return () => { live = false; };
  }, [uid, fetchBundle]);

  const value = useMemo<Ctx>(() => ({
    bundle, error, loading, refreshing,
    refresh: () => fetchBundle(true),
    petCount: bundle ? bundle.pets.reduce((m, p) => m.set(p.owner, (m.get(p.owner) ?? 0) + 1), new Map<string, number>()) : new Map(),
    engaged: new Set(bundle?.engaged ?? []),
  }), [bundle, error, loading, refreshing, fetchBundle]);

  return <BundleCtx.Provider value={value}>{children}</BundleCtx.Provider>;
}

export function useBundle() {
  const c = useContext(BundleCtx);
  if (!c) throw new Error("useBundle outside BundleProvider");
  return c;
}
export const clearBundleCache = idbClear;
