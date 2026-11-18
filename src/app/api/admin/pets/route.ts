import { handle, requireAdmin } from "@/lib/server/admin";
import { loadAuthUsers, loadEngagement } from "@/lib/server/data";

const PAGE = 50;

export const GET = handle(async (req) => {
  await requireAdmin(req);
  const sp = new URL(req.url).searchParams;
  const [users, eng] = await Promise.all([loadAuthUsers(), loadEngagement()]);
  const byUid = new Map(users.map((u) => [u.uid, u]));
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const owner = (sp.get("owner") ?? "").trim().toLowerCase();
  const category = sp.get("category") ?? "";
  const status = sp.get("status") ?? "";
  const page = Math.max(1, Number(sp.get("page") ?? 1));

  let rows = eng.pets;
  if (category) rows = rows.filter((p) => p.category === category);
  if (status) rows = rows.filter((p) => p.status === status);
  if (q) rows = rows.filter((p) => p.name.toLowerCase().includes(q));
  if (owner)
    rows = rows.filter((p) => {
      const u = byUid.get(p.owner);
      return p.owner === owner || !!u?.email.toLowerCase().includes(owner) || !!u?.name.toLowerCase().includes(owner);
    });
  rows = [...rows].sort((a, b) => b.created - a.created);

  return {
    total: rows.length,
    page,
    pageSize: PAGE,
    pets: rows.slice((page - 1) * PAGE, page * PAGE).map((p) => ({
      ...p,
      ownerEmail: byUid.get(p.owner)?.email ?? "",
      ownerName: byUid.get(p.owner)?.name ?? "",
    })),
  };
});
