import { adminDb, handle, requireAdmin } from "@/lib/server/admin";
import { readVersionCfg, saveVersionCfg, type PlatformCfg } from "@/lib/server/appversion";

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const [cfg, tokens] = await Promise.all([
    readVersionCfg(),
    adminDb().collectionGroup("fcm_tokens").select("device_type").get(),
  ]);
  const audience = { ios: 0, android: 0, other: 0 };
  tokens.docs.forEach((d) => {
    const t = String(d.get("device_type") ?? "").toLowerCase();
    if (t === "ios") audience.ios++; else if (t === "android") audience.android++; else audience.other++;
  });
  return { ...cfg, audience };
});

export const POST = handle(async (req) => {
  const admin = await requireAdmin(req);
  const b = (await req.json().catch(() => null)) as { ios?: PlatformCfg; android?: PlatformCfg; message?: string } | null;
  if (!b?.ios || !b?.android) throw new (await import("@/lib/server/admin")).HttpError(400, "ios and android settings are required.");
  await saveVersionCfg({ ios: b.ios, android: b.android, message: b.message ?? "" }, admin.email ?? admin.uid);
  return readVersionCfg();
});
