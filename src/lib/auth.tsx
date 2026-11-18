"use client";

import {
  getIdTokenResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { auth } from "./firebase";

type Status = "loading" | "signed-out" | "admin";
interface Ctx {
  status: Status;
  user: User | null;
  notice: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const AuthCtx = createContext<Ctx | null>(null);
export const NOT_AUTHORISED = "Not authorised";

async function isAdmin(u: User) {
  // force refresh so a freshly-set claim is picked up
  const t = await getIdTokenResult(u, true);
  return t.claims.admin === true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        if (!u) {
          setUser(null);
          setStatus("signed-out");
          return;
        }
        try {
          if (await isAdmin(u)) {
            setUser(u);
            setNotice(null);
            setStatus("admin");
            return;
          }
          setNotice(NOT_AUTHORISED);
        } catch (e) {
          setNotice(`Could not verify admin access: ${(e as Error).message}`);
        }
        await signOut(auth);
      }),
    [],
  );

  const signIn = async (email: string, password: string) => {
    setNotice(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(code))
        throw new Error("Sign-in failed: wrong email or password.");
      if (code === "auth/too-many-requests")
        throw new Error("Sign-in failed: too many attempts, try again later.");
      throw new Error(`Sign-in failed: ${(e as Error).message}`);
    }
  };

  return (
    <AuthCtx.Provider value={{ status, user, notice, signIn, logout: () => signOut(auth) }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
