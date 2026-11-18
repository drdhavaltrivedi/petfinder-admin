import { adminDb, HttpError } from "./admin";

export interface PlatformCfg { latest: string; min: string; url: string }
export interface VersionCfg {
  ios: PlatformCfg;
  android: PlatformCfg;
  message: string;
  updatedAt: number | null;
  updatedBy: string;
  lastNotifiedAt: number | null;
}

const EMPTY: PlatformCfg = { latest: "", min: "", url: "" };
// One small doc, written/read only through the Admin SDK (never by app clients).
const ref = () => adminDb().doc("AppConfig/version");

export async function readVersionCfg(): Promise<VersionCfg> {
  const s = await ref().get();
  const d = (s.data() ?? {}) as Partial<Record<string, unknown>>;
  const p = (v: unknown): PlatformCfg => {
    const o = (v ?? {}) as Partial<PlatformCfg>;
    return { latest: String(o.latest ?? ""), min: String(o.min ?? ""), url: String(o.url ?? "") };
  };
  const ts = (v: unknown) => (v && typeof (v as { toMillis?: unknown }).toMillis === "function" ? (v as { toMillis(): number }).toMillis() : null);
  return {
    ios: s.exists ? p(d.ios) : EMPTY,
    android: s.exists ? p(d.android) : EMPTY,
    message: String(d.message ?? ""),
    updatedAt: ts(d.updatedAt),
    updatedBy: String(d.updatedBy ?? ""),
    lastNotifiedAt: ts(d.lastNotifiedAt),
  };
}

const VERSION = /^\d+(\.\d+){0,2}$/;
export const cmp = (a: string, b: string) => {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
};

export function validatePlatform(name: string, c: PlatformCfg): PlatformCfg {
  const latest = c.latest.trim(), min = c.min.trim(), url = c.url.trim();
  if (latest && !VERSION.test(latest)) throw new HttpError(400, `${name}: latest version must look like 1.4.0.`);
  if (min && !VERSION.test(min)) throw new HttpError(400, `${name}: minimum version must look like 1.4.0.`);
  if (min && !latest) throw new HttpError(400, `${name}: set the latest version before a minimum.`);
  if (min && latest && cmp(min, latest) > 0) throw new HttpError(400, `${name}: minimum version cannot be higher than the latest version.`);
  if (url && !/^https:\/\//.test(url)) throw new HttpError(400, `${name}: store link must start with https://`);
  if ((latest || min) && !url) throw new HttpError(400, `${name}: add the store link so users can update.`);
  return { latest, min, url };
}

export async function saveVersionCfg(input: { ios: PlatformCfg; android: PlatformCfg; message: string }, by: string) {
  const message = input.message.trim().slice(0, 300);
  await ref().set(
    {
      ios: validatePlatform("iOS", input.ios),
      android: validatePlatform("Android", input.android),
      message,
      updatedAt: new Date(),
      updatedBy: by,
    },
    { merge: true },
  );
}

export const markNotified = () => ref().set({ lastNotifiedAt: new Date() }, { merge: true });
