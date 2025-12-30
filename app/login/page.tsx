// app/login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/admin";

export default function PlayerLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // إذا اللاعب مسجل دخول بالفعل، ودّه للفئات (لكن إذا أدمن لا نوديه هنا)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      if (isAdminEmail(user.email)) return; // الأدمن دخوله من /admin/login
      router.replace("/categories");
    });
    return () => unsub();
  }, [router]);

  async function handleGoogleLogin() {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);

      // خزّن اللاعب في قاعدة البيانات
      await setDoc(
        doc(db, "players", res.user.uid),
        {
          uid: res.user.uid,
          name: res.user.displayName || "لاعب",
          email: res.user.email || "",
          photoURL: res.user.photoURL || "",
          lastLoginAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // إذا أدمن بالخطأ دخل من هنا، لا نوديه للعبة
      if (isAdminEmail(res.user.email)) {
        router.replace("/admin");
      } else {
        router.replace("/categories");
      }
    } catch (e: any) {
      alert(e?.message || "حدث خطأ في تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#0b0b0f",
      }}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          background: "white",
          borderRadius: 18,
          padding: 22,
          boxShadow: "0 18px 50px rgba(0,0,0,.25)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28 }}>تسجيل الدخول</h1>
        <p style={{ opacity: 0.7, marginTop: 8 }}>
          لازم تسجل دخول عشان تقدر تلعب
        </p>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: "100%",
            height: 54,
            borderRadius: 14,
            border: "none",
            background: "#f7c500",
            color: "#111",
            fontWeight: 900,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول عبر Google"}
        </button>
      </div>
    </div>
  );
}