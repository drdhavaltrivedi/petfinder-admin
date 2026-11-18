"use client";

import { Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast";
import { Badge, ErrorBox, PageHeader, Skeleton, btnDanger, btnGhost, btnPrimary, input } from "@/components/ui";
import { api, fmtMs } from "@/lib/api";
import { useBundle } from "@/lib/bundle";
import { invalidate, useApi } from "@/lib/query";

interface P { latest: string; min: string; url: string }
interface Cfg { ios: P; android: P; message: string; updatedAt: number | null; updatedBy: string; lastNotifiedAt: number | null; audience: { ios: number; android: number; other: number } }
type Form = { latest: string; required: boolean; url: string; prevMin: string };

const PLAY = "https://play.google.com/store/apps/details?id=com.brilworks.petfinder";
const toForm = (p: P): Form => ({ latest: p.latest, required: !!p.latest && p.min === p.latest, url: p.url, prevMin: p.min && p.min !== p.latest ? p.min : "" });
// "Required" raises the minimum to the latest; "Optional" keeps any older minimum already in force.
const toCfg = (f: Form): P => ({ latest: f.latest.trim(), min: f.required ? f.latest.trim() : f.prevMin, url: f.url.trim() });

function Platform({ name, f, set }: { name: string; f: Form; set: (f: Form) => void }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <h2 className="flex items-center gap-2 font-semibold"><Smartphone className="h-4 w-4" />{name}</h2>
      <label className="block space-y-1"><span className="text-sm font-medium">Latest version</span>
        <input className={input} placeholder="e.g. 1.4.0" value={f.latest} onChange={(e) => set({ ...f, latest: e.target.value })} />
      </label>
      <fieldset className="space-y-1"><legend className="text-sm font-medium">Update type</legend>
        {[[false, "Optional", "Users get a prompt they can dismiss (once per app launch)."], [true, "Required", "Users on older versions are blocked until they update."]].map(([v, l, d]) => (
          <label key={String(v)} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm ${f.required === v ? "border-accent bg-accent/10" : "border-border"}`}>
            <input type="radio" className="mt-1" checked={f.required === v} onChange={() => set({ ...f, required: v as boolean })} />
            <span><b>{l as string}</b><span className="block text-xs text-muted">{d as string}</span></span>
          </label>
        ))}
      </fieldset>
      <label className="block space-y-1"><span className="text-sm font-medium">Store link</span>
        <input className={input} placeholder="https://…" value={f.url} onChange={(e) => set({ ...f, url: e.target.value })} />
      </label>
      {f.latest && <p className="text-xs text-muted">{f.required ? <>Versions below <b>{f.latest}</b> are blocked.</> : <>Versions below <b>{f.latest}</b> get a dismissible prompt{f.prevMin ? <>; versions below <b>{f.prevMin}</b> stay blocked</> : null}.</>}</p>}
    </section>
  );
}

export default function AppUpdatesPage() {
  const toast = useToast();
  const { bundle } = useBundle();
  const { data, error, reload } = useApi<Cfg>("/api/admin/app-version", 30_000);
  const [ios, setIos] = useState<Form | null>(null);
  const [android, setAndroid] = useState<Form | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  // push
  const [audience, setAudience] = useState<"all" | "ios" | "android">("all");
  const [title, setTitle] = useState("A new version of PetFinder is here");
  const [body, setBody] = useState("Update the app to get the latest improvements.");
  const [testQ, setTestQ] = useState("");
  const [typed, setTyped] = useState("");
  const [pushing, setPushing] = useState(false);

  useEffect(() => {
    if (!data) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setIos(toForm(data.ios));
    setAndroid(toForm({ ...data.android, url: data.android.url || PLAY }));
    setMessage(data.message);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [data]);

  const testUser = useMemo(() => {
    const t = testQ.trim().toLowerCase();
    if (t.length < 3 || !bundle) return null;
    return bundle.users.find((u) => u[1].toLowerCase() === t || u[0] === testQ.trim()) ?? null;
  }, [testQ, bundle]);

  if (error) return <ErrorBox message={`Failed to load: ${error}`} onRetry={reload} />;
  if (!data || !ios || !android) return <div className="space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;

  const anyRequired = (ios.required && ios.latest) || (android.required && android.latest);

  async function save() {
    setSaving(true); setErr(null);
    try {
      await api("/api/admin/app-version", { method: "POST", body: JSON.stringify({ ios: toCfg(ios!), android: toCfg(android!), message }) });
      invalidate("/api/admin/app-version");
      toast("ok", "Saved. Apps pick this up within about a minute.");
      setConfirmSave(false); reload();
    } catch (e) { setErr((e as Error).message); setConfirmSave(false); }
    finally { setSaving(false); }
  }

  async function push(test: boolean) {
    setPushing(true); setErr(null);
    try {
      const r = await api<{ devices: number; sent: number; failed: number }>("/api/admin/app-version/notify", {
        method: "POST",
        body: JSON.stringify(test ? { testUid: testUser?.[0], title, body } : { audience, title, body, confirm: typed }),
      });
      toast("ok", `${test ? "Test" : "Push"} sent to ${r.sent}/${r.devices} devices${r.failed ? ` (${r.failed} failed)` : ""}.`);
      setTyped(""); invalidate("/api/admin/app-version"); reload();
    } catch (e) { setErr((e as Error).message); }
    finally { setPushing(false); }
  }

  const count = audience === "all" ? data.audience.ios + data.audience.android + data.audience.other : data.audience[audience];

  return (
    <div className="space-y-6">
      <PageHeader title="App updates" sub="Tell users a new version is out, and choose whether the update is optional or required."
        actions={data.updatedAt ? <span className="text-xs text-muted">Last saved {fmtMs(data.updatedAt)} by {data.updatedBy || "—"}</span> : <Badge>Not configured yet</Badge>} />
      {err && <ErrorBox message={err} />}

      <div className="grid gap-4 md:grid-cols-2">
        <Platform name="iOS (App Store)" f={ios} set={setIos} />
        <Platform name="Android (Google Play)" f={android} set={setAndroid} />
      </div>
      <label className="block space-y-1"><span className="text-sm font-medium">Message shown in the update prompt (optional)</span>
        <textarea className={`${input} min-h-20`} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What's new, or why this update matters." />
      </label>
      <div className="flex items-center gap-3">
        <button className={btnPrimary} disabled={saving} onClick={() => (anyRequired ? setConfirmSave(true) : save())}>{saving ? "Saving…" : "Save settings"}</button>
        <p className="text-xs text-muted">The app checks on launch. If this page can&apos;t be reached the app simply skips the check, so nobody gets locked out by mistake.</p>
      </div>

      <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="font-semibold">Announce with a push notification</h2>
        <p className="text-xs text-muted">Save the settings first, and only announce after the new build is live in the store. {data.lastNotifiedAt ? `Last push: ${fmtMs(data.lastNotifiedAt)}.` : ""}</p>
        <div className="grid gap-2 md:grid-cols-2">
          <input className={input} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Push title" />
          <input className={input} maxLength={180} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Push message" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input className={`${input} max-w-72`} placeholder="Test: a user's exact email or uid" value={testQ} onChange={(e) => setTestQ(e.target.value)} />
          <button className={btnGhost} disabled={!testUser || pushing} onClick={() => push(true)}>Send test to this user</button>
          {testQ.trim().length >= 3 && !testUser && <span className="text-xs text-muted">No exact match in the cached user list.</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <select className={`${input} !w-auto`} value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
            <option value="all">All devices</option><option value="ios">iOS only</option><option value="android">Android only</option>
          </select>
          <span className="text-sm text-muted tabular-nums">{count.toLocaleString()} devices</span>
          <input className={`${input} max-w-40`} placeholder='Type SEND to enable' value={typed} onChange={(e) => setTyped(e.target.value)} />
          <button className={btnDanger} disabled={typed !== "SEND" || pushing} onClick={() => push(false)}>{pushing ? "Sending…" : "Send to users"}</button>
        </div>
      </section>

      {confirmSave && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-surface p-5">
            <h3 className="font-semibold">Block older versions?</h3>
            <p className="text-sm text-muted">A <b className="text-fg">required</b> update stops users on older versions from using the app until they update. Make sure the new build is already live in the store.</p>
            <div className="flex justify-end gap-3"><button className={btnGhost} onClick={() => setConfirmSave(false)}>Cancel</button><button className={btnDanger} onClick={save} disabled={saving}>Save and require update</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
