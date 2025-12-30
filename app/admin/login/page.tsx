// app/admin/login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/admin";

export default function AdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // إذا الأدمن مسجل دخول مسبقاً: دخله للداش بورد
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (isAdminEmail(user?.email)) router.replace("/admin");
    });
    return () => unsub();
  }, [router]);

  async function handleAdminGoogleLogin() {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);

      if (!isAdminEmail(res.user.email)) {
        await signOut(auth);
        alert("هذا الحساب ليس أدمن.");
        return;
      }

      router.replace("/admin");
    } catch (e: any) {
      alert(e?.message || "حدث خطأ في تسجيل دخول الأدمن");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div
        style={{
          width: "min(560px, 92vw)",
          background: "white",
          borderRadius: 18,
          padding: 24,
          boxShadow: "0 18px 50px rgba(0,0,0,.12)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 30 }}>لوحة الأدمن</h1>
        <p style={{ opacity: 0.7, marginTop: 8 }}>
          هذه الصفحة خاصة بالأدمن فقط
        </p>

        <button
          onClick={handleAdminGoogleLogin}
          disabled={loading}
          style={{
            marginTop: 14,
            width: "100%",
            height: 54,
            borderRadius: 14,
            border: "none",
            background: "#6d28d9",
            color: "white",
            fontWeight: 900,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "جارٍ تسجيل الدخول..." : "تسجيل دخول الأدمن عبر Google"}
        </button>
      </div>
    </div>
  );
}