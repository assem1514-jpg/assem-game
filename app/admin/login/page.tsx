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

const ADMIN_EMAIL = "assem1514@gmail.com";

export default function AdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setChecking(false);

      if (!user) return;

      const email = (user.email || "").toLowerCase().trim();

      if (email === ADMIN_EMAIL) {
        router.replace("/admin");
        return;
      }

      setError("هذا الحساب غير مصرح له بالدخول للوحة الأدمن.");
      await signOut(auth);
    });

    return () => unsub();
  }, [router]);

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      const email = (result.user.email || "").toLowerCase().trim();

      if (email !== ADMIN_EMAIL) {
        await signOut(auth);
        setError("هذا الحساب غير مصرح له بالدخول للوحة الأدمن.");
        return;
      }

      router.replace("/admin");
    } catch (e: any) {
      setError(e?.message || "حدث خطأ في تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "#FAF0CA",
        direction: "rtl",
        color: "#0D3B66",
      }}
    >
      <div
        style={{
          width: "min(560px, 92vw)",
          background: "white",
          borderRadius: 24,
          padding: 24,
          boxShadow: "0 18px 50px rgba(13,59,102,.16)",
          border: "1px solid rgba(13,59,102,.12)",
        }}
      >
        <div
          style={{
            width: 86,
            height: 86,
            borderRadius: 24,
            background: "#0D3B66",
            margin: "0 auto 14px",
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="مستوى"
            style={{
              width: "82%",
              height: "82%",
              objectFit: "contain",
            }}
          />
        </div>

        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 1000, textAlign: "center" }}>
          لوحة الأدمن
        </h1>

        <p
          style={{
            opacity: 0.75,
            marginTop: 8,
            textAlign: "center",
            fontWeight: 800,
          }}
        >
          سجّل دخول بحساب الأدمن المصرّح فقط
        </p>

        {error && (
          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 14,
              background: "rgba(220,38,38,.08)",
              color: "#b91c1c",
              fontWeight: 900,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading || checking}
          style={{
            marginTop: 16,
            width: "100%",
            height: 56,
            borderRadius: 16,
            border: "none",
            background: "#0D3B66",
            color: "#FAF0CA",
            fontWeight: 1000,
            cursor: loading || checking ? "not-allowed" : "pointer",
            fontSize: 16,
          }}
        >
          {checking
            ? "جارٍ التحقق..."
            : loading
              ? "جارٍ تسجيل الدخول..."
              : "تسجيل دخول عبر Google"}
        </button>

        <p
          style={{
            margin: "14px 0 0",
            fontSize: 13,
            opacity: 0.65,
            textAlign: "center",
            fontWeight: 800,
          }}
        >
          الدخول مسموح فقط للحساب: Assem1514@gmail.com
        </p>
      </div>
    </main>
  );
}