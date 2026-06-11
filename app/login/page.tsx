// app/login/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

const COLORS = {
  navy: "#0D3B66",
  cream: "#FAF0CA",
  yellow: "#F4D35E",
};

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  async function handleSubmit() {
    if (!acceptedPrivacy) {
      return alert("يجب الموافقة على سياسة الخصوصية أولاً");
    }

    if (!email || !password) return alert("أكمل البيانات");

    setLoading(true);

    try {
      if (mode === "register") {
        if (!name.trim()) {
          setLoading(false);
          return alert("اكتب اسمك");
        }

        if (password !== password2) {
          setLoading(false);
          return alert("كلمة المرور غير متطابقة");
        }

        const res = await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

        await updateProfile(res.user, {
          displayName: name.trim(),
        });

        router.push("/");
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        router.push("/");
      }
    } catch (e: any) {
      alert(e?.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (!acceptedPrivacy) {
      return alert("يجب الموافقة على سياسة الخصوصية أولاً");
    }

    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push("/");
    } catch (e: any) {
      alert(e?.message || "حدث خطأ في تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot() {
    if (!email.trim()) return alert("اكتب إيميلك أولاً");

    try {
      await sendPasswordResetEmail(auth, email.trim());
      alert("تم إرسال رابط تغيير كلمة المرور لبريدك");
    } catch (e: any) {
      alert(e?.message || "حدث خطأ");
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        width: "100%",
        background: `linear-gradient(180deg, ${COLORS.navy} 0%, #082944 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "22px 16px",
        boxSizing: "border-box",
        direction: "rtl",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 430,
          background: COLORS.cream,
          borderRadius: 30,
          padding: "26px 20px",
          boxShadow: "0 24px 70px rgba(0,0,0,.30)",
          border: "1px solid rgba(255,255,255,.22)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 86,
            height: 86,
            borderRadius: 26,
            background: COLORS.navy,
            margin: "0 auto 18px",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 16px 36px rgba(13,59,102,.30)",
          }}
        >
          <span
            style={{
              color: COLORS.yellow,
              fontSize: 38,
              fontWeight: 1000,
              lineHeight: 1,
            }}
          >
            م
          </span>
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 34,
            fontWeight: 1000,
            color: COLORS.navy,
            lineHeight: 1.2,
          }}
        >
          حيّاك في مستوى
        </h1>

        <p
          style={{
            margin: "10px auto 18px",
            color: "rgba(13,59,102,.78)",
            fontSize: 16,
            fontWeight: 800,
            lineHeight: 1.7,
            maxWidth: 330,
          }}
        >
          {mode === "login"
            ? "سجّل دخولك وابدأ اللعب"
            : "أنشئ حساب جديد وابدأ التحدي"}
        </p>

        <div
          style={{
            display: "grid",
            gap: 12,
            textAlign: "right",
          }}
        >
          {mode === "register" && (
            <input
              placeholder="اسمك"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          )}

          <input
            placeholder="اكتب إيميلك هنا"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            style={inputStyle}
          />

          <input
            type="password"
            placeholder="كلمة المرور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          {mode === "register" && (
            <input
              type="password"
              placeholder="أعد كلمة المرور"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              style={inputStyle}
            />
          )}
        </div>

        <label
          style={{
            marginTop: 18,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            textAlign: "right",
            color: COLORS.navy,
            fontSize: 14,
            fontWeight: 800,
            lineHeight: 1.7,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={acceptedPrivacy}
            onChange={(e) => setAcceptedPrivacy(e.target.checked)}
            style={{
              width: 20,
              height: 20,
              marginTop: 2,
              accentColor: COLORS.navy,
              flex: "0 0 auto",
            }}
          />

          <span>
            أوافق على{" "}
            <Link
              href="/privacy"
              style={{
                color: COLORS.navy,
                fontWeight: 1000,
                textDecoration: "underline",
              }}
            >
              سياسة الخصوصية
            </Link>{" "}
            الخاصة بتطبيق مستوى.
          </span>
        </label>

        <button
          onClick={handleSubmit}
          disabled={loading || !acceptedPrivacy}
          style={{
            width: "100%",
            minHeight: 58,
            borderRadius: 18,
            border: "none",
            background: acceptedPrivacy ? COLORS.yellow : "rgba(244,211,94,.55)",
            color: COLORS.navy,
            fontWeight: 1000,
            fontSize: 17,
            cursor: loading || !acceptedPrivacy ? "not-allowed" : "pointer",
            marginTop: 18,
            boxShadow: acceptedPrivacy
              ? "0 14px 30px rgba(13,59,102,.18)"
              : "none",
          }}
        >
          {loading
            ? "جارٍ المعالجة..."
            : mode === "login"
            ? "تسجيل الدخول"
            : "إنشاء حساب"}
        </button>

        <button
          onClick={handleGoogle}
          disabled={loading || !acceptedPrivacy}
          style={{
            width: "100%",
            minHeight: 58,
            borderRadius: 18,
            border: `2px solid ${COLORS.navy}`,
            background: "#fff",
            color: COLORS.navy,
            fontWeight: 1000,
            fontSize: 16,
            marginTop: 12,
            cursor: loading || !acceptedPrivacy ? "not-allowed" : "pointer",
            opacity: loading || !acceptedPrivacy ? 0.65 : 1,
          }}
        >
          تسجيل عبر Google
        </button>

        {mode === "login" && (
          <button
            type="button"
            onClick={handleForgot}
            style={{
              marginTop: 14,
              background: "transparent",
              border: "none",
              color: COLORS.navy,
              fontWeight: 1000,
              fontSize: 14,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            نسيت كلمة المرور؟
          </button>
        )}

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          style={{
            marginTop: 18,
            width: "100%",
            minHeight: 50,
            borderRadius: 18,
            border: "1px solid rgba(13,59,102,.18)",
            background: "rgba(255,255,255,.36)",
            color: COLORS.navy,
            fontWeight: 1000,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          {mode === "login"
            ? "ما عندك حساب؟ أنشئ حساب"
            : "عندك حساب؟ تسجيل دخول"}
        </button>

        <Link
          href="/"
          style={{
            marginTop: 12,
            width: "100%",
            minHeight: 48,
            borderRadius: 18,
            color: "rgba(13,59,102,.78)",
            fontWeight: 900,
            fontSize: 14,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          الرجوع للرئيسية
        </Link>
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 54,
  borderRadius: 18,
  border: "2px solid rgba(13,59,102,.12)",
  outline: "none",
  padding: "0 16px",
  fontSize: 16,
  fontWeight: 800,
  color: "#0D3B66",
  background: "rgba(255,255,255,.72)",
  boxSizing: "border-box",
};