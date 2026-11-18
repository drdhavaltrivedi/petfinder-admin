import { adminDb, handle, requireAdmin } from "@/lib/server/admin";
import { DAY, distanceKm, loadAuthUsers, loadEngagement, loadGeoUsers } from "@/lib/server/data";

export const maxDuration = 120;
const PAGE = 50;

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const sp = new URL(req.url).searchParams;
  const now = Date.now();
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const filter = sp.get("filter") ?? "all";
  const address = (sp.get("address") ?? "").trim().toLowerCase();
  const lat = Number(sp.get("lat")), lng = Number(sp.get("lng")), radius = Number(sp.get("radius"));
  const page = Math.max(1, Number(sp.get("page") ?? 1));

  const [users, eng] = await Promise.all([loadAuthUsers(), loadEngagement()]);
  let rows = users;

  if (q) rows = rows.filter((u) => u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || u.uid === q);
  switch (filter) {
    case "new7": rows = rows.filter((u) => now - u.created < 7 * DAY); break;
    case "new30": rows = rows.filter((u) => now - u.created < 30 * DAY); break;
    case "active7": rows = rows.filter((u) => now - u.lastSeen < 7 * DAY); break;
    case "never-engaged": rows = rows.filter((u) => !eng.engaged.has(u.uid)); break;
    case "never-returned": rows = rows.filter((u) => u.lastSeen - u.created < DAY); break;
    case "inactive30": rows = rows.filter((u) => now - u.lastSeen >= 30 * DAY); break;
    case "has-pets": rows = rows.filter((u) => eng.petCount.has(u.uid)); break;
  }

  const geoFilter = !!address || (Number.isFinite(lat) && Number.isFinite(lng) && radius > 0 && sp.has("lat"));
  if (geoFilter) {
    const geo = await loadGeoUsers();
    const ok = new Set(
      geo
        .filter((g) => !address || g.address.toLowerCase().includes(address))
        .filter((g) => !(sp.has("lat") && radius > 0) || distanceKm({ lat, lng }, g) <= radius)
        .map((g) => g.uid),
    );
    rows = rows.filter((u) => ok.has(u.uid));
  }

  rows = [...rows].sort((a, b) => b.created - a.created);
  const total = rows.length;
  if (sp.get("all") === "1") {
    // export: auth data only (no per-user Firestore lookups), capped
    return {
      total,
      users: rows.slice(0, 50_000).map((u) => ({
        uid: u.uid, email: u.email, name: u.name, created: u.created, lastSeen: u.lastSeen,
        pets: eng.petCount.get(u.uid) ?? 0, engaged: eng.engaged.has(u.uid),
      })),
    };
  }
  const slice = rows.slice((page - 1) * PAGE, page * PAGE);

  const db = adminDb();
  const docs = slice.length ? await db.getAll(...slice.map((u) => db.doc(`Users/${u.uid}`)), { fieldMask: ["display_name", "photo_url", "Address", "location"] }) : [];
  const prof = new Map(docs.map((d) => [d.id, d]));

  return {
    total,
    page,
    pageSize: PAGE,
    geoNote: geoFilter ? "Location filters only match users who have a stored location (about 2% of users)." : null,
    users: slice.map((u) => {
      const d = prof.get(u.uid);
      return {
        uid: u.uid,
        email: u.email,
        name: d?.get("display_name") || u.name,
        photo: d?.get("photo_url") ?? "",
        address: d?.get("Address") ?? "",
        hasLocation: !!d?.get("location"),
        created: u.created,
        lastSeen: u.lastSeen,
        pets: eng.petCount.get(u.uid) ?? 0,
        engaged: eng.engaged.has(u.uid),
        disabled: u.disabled,
      };
    }),
  };
});
