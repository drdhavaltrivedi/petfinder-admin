import { readVersionCfg } from "@/lib/server/appversion";

// PUBLIC, read-only: the mobile app calls this on launch. It exposes only version numbers,
// store links and a short message. The app fails open if this is unreachable.
export async function GET() {
  try {
    const c = await readVersionCfg();
    return Response.json(
      { ios: c.ios, android: c.android, message: c.message },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300", "Access-Control-Allow-Origin": "*" } },
    );
  } catch {
    // Never break the app: an empty config means "no update".
    return Response.json({ ios: { latest: "", min: "", url: "" }, android: { latest: "", min: "", url: "" }, message: "" }, { headers: { "Cache-Control": "public, s-maxage=30" } });
  }
}
