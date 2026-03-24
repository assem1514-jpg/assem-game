"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

type AuthCtx = {
  user: User | null;
  loading: boolean;
};

const Ctx = createContext<AuthCtx>({ user: null, loading: true });

async function ensureUserDoc(u: User) {
  try {
    const ref = doc(db, "users", u.uid);
    const snap = await getDoc(ref);

    const provider = u.providerData?.[0]?.providerId ?? "password";

    // ✅ إذا أول مرة: أنشئ المستند + createdAt
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: u.uid,
        name: u.displayName ?? "",
        email: u.email ?? "",
        photoURL: u.photoURL ?? "",
        provider,
        credits: 0,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
      return;
    }

    // ✅ إذا موجود: حدّث آخر دخول + أي بيانات تغيّرت
    await setDoc(
      ref,
      {
        uid: u.uid,
        name: u.displayName ?? "",
        email: u.email ?? "",
        photoURL: u.photoURL ?? "",
        provider,
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.error("ensureUserDoc error:", e);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);

      // ✅ أول ما يسجل دخول، نضمن وجوده في Firestore
      if (u) await ensureUserDoc(u);
    });
    return () => unsub();
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}