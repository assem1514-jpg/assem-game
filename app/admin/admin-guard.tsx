// app/admin/admin-guard.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/admin";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      const ok = isAdminEmail(user?.email);

      // صفحة /admin/login لا تحتاج guard
      if (pathname === "/admin/login") {
        setReady(true);
        return;
      }

      if (!user) {
        router.replace("/admin/login");
        setReady(true);
        return;
      }

      if (!ok) {
        // لو مستخدم عادي دخل على /admin بالغلط: طلّعه وودّه لتسجيل دخول الأدمن
        await signOut(auth);
        router.replace("/admin/login");
        setReady(true);
        return;
      }

      setReady(true);
    });

    return () => unsub();
  }, [router, pathname]);

  if (!ready) return null;
  return <>{children}</>;
}