"use client";

import { LayoutDashboard, Link2, Menu, Moon, Newspaper, PawPrint, Sun, Users, LogOut, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Skeleton, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { BundleProvider, clearBundleCache } from "@/lib/bundle";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/pets", label: "Pets", icon: PawPrint },
  { href: "/matches", label: "Connect", icon: Link2 },
  { href: "/posts", label: "Posts", icon: Newspaper },
];

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);
  return (
    <button
      aria-label="Toggle dark mode"
      className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg"
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.dataset.theme = next ? "dark" : "light";
        try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* ignore */ }
      }}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Spinner label="Loading…" />}><Shell>{children}</Shell></Suspense>;
}

function Shell({ children }: { children: ReactNode }) {
  const { status, user, logout } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => { if (status === "signed-out") router.replace("/login"); }, [status, router]);

  if (status !== "admin")
    return (
      <div className="mx-auto max-w-md space-y-3 p-8"><Skeleton className="h-8 w-48" /><Skeleton className="h-24" /><Spinner label="Checking access…" /></div>
    );

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/dashboard" className="flex items-center gap-2 px-5 py-5 text-lg font-semibold tracking-tight">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-fg"><PawPrint className="h-4 w-4" /></span>
        PetFinder
      </Link>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-surface-2 hover:text-fg"}`}>
              <Icon className="h-4 w-4" />{label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-1 border-t border-border p-3">
        <div className="min-w-0 flex-1 truncate px-2 text-xs text-muted" title={user?.email ?? ""}>{user?.email}</div>
        <ThemeToggle />
        <button aria-label="Sign out" className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg"
          onClick={async () => { await clearBundleCache(); await logout(); }}><LogOut className="h-4 w-4" /></button>
      </div>
    </div>
  );

  return (
    <BundleProvider>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-surface lg:block">{sidebar}</aside>
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-surface px-4 py-3 lg:hidden">
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-lg p-1.5 hover:bg-surface-2"><Menu className="h-5 w-5" /></button>
        <span className="font-semibold">PetFinder Admin</span>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-surface shadow-xl">
            <button aria-label="Close menu" className="absolute right-3 top-4 rounded-lg p-1.5 hover:bg-surface-2" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <main className="min-h-screen px-4 py-6 lg:pl-[17rem] lg:pr-8"><div className="mx-auto max-w-6xl">{children}</div></main>
    </BundleProvider>
  );
}
