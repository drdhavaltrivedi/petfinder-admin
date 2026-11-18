"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

/** Keeps simple string state in the URL (shareable/bookmarkable). Defaults are omitted from the URL. */
export function useUrlState<T extends Record<string, string>>(defaults: T) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const values = useMemo(() => {
    const o = { ...defaults } as Record<string, string>;
    for (const k of Object.keys(defaults)) o[k] = sp.get(k) ?? defaults[k];
    return o as T;
  }, [sp, defaults]);
  const set = useCallback((patch: Partial<T>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === defaults[k] || v === "") next.delete(k);
      else next.set(k, v as string);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [sp, router, pathname, defaults]);
  return [values, set] as const;
}
