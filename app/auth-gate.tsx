// app/auth-gate.tsx
"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "").toLowerCase();

// صفحات مسموحة بدون تسجيل دخول
const PUBLIC_PATHS = new Set<string>(["/login", "/admin/login"]);

function isAdmin(user: User | null) {
  const email = (user?.email || "").toLowerCase();
  return !!email && email === ADMIN_EMAIL;
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (loading) return;

    const currentPath = pathname || "/";

    // غير مسجل دخول
    if (!user) {
      // أي صفحة غير عامة تتطلب تسجيل دخول
      if (!PUBLIC_PATHS.has(currentPath)) {
        // هنا تقدر تختار: تخلي الكل لازم يسجل دخول أو فقط صفحات اللعب
        // حاليا: الكل لازم يسجل دخول
        router.replace("/login");
      }
      return;
    }

    // مسجل دخول:
    // إذا رايح صفحة تسجيل دخول لاعب
    if (currentPath === "/login") {
      router.replace("/");
      return;
    }

    // إذا رايح صفحة تسجيل دخول أدمن
    if (currentPath === "/admin/login") {
      router.replace(isAdmin(user) ? "/admin" : "/");
      return;
    }

    // حماية /admin: لازم أدمن
    if (currentPath.startsWith("/admin") && !isAdmin(user)) {
      router.replace("/");
      return;
    }
  }, [loading, user, pathname, router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div>جاري التحقق من تسجيل الدخول...</div>
      </div>
    );
  }

  if (!user && !PUBLIC_PATHS.has(pathname || "/")) return null;

  return <>{children}</>;
}