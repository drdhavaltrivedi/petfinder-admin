"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Spinner, btnGhost } from "@/components/ui";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { status, user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "signed-out") router.replace("/login");
  }, [status, router]);

  if (status !== "admin") return <Spinner label="Checking access…" />;

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/dashboard" className="font-semibold">🐾 PetFinder Admin</Link>
          <nav className="flex gap-3 text-sm text-slate-600">
            {[["/dashboard", "Dashboard"], ["/users", "Users"], ["/pets", "Pets"], ["/matches", "Connect"], ["/posts", "Posts"]].map(([h, l]) => (
              <Link key={h} href={h} className="hover:text-slate-900">{l}</Link>
            ))}
          </nav>
          <span className="ml-auto hidden text-xs text-slate-500 sm:block">{user?.email}</span>
          <button onClick={logout} className={btnGhost}>Sign out</button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
