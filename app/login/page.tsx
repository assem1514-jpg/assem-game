"use client";

import { useState } from "react";
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

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  async function handleSubmit() {
    if (!email || !password) return alert("اكمل البيانات");

    setLoading(true);

    try {
      if (mode === "register") {
        if (!name) return alert("اكتب اسمك");
        if (password !== password2)
          return alert("كلمة المرور غير متطابقة");

        const res = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        await updateProfile(res.user, {
          displayName: name,
        });

        router.push("/");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        router.push("/");
      }
    } catch (e: any) {
      alert(e.message);
    }

    setLoading(false);
  }

  async function handleGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push("/");
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleForgot() {
    if (!email) return alert("اكتب ايميلك اول");
    try {
      await sendPasswordResetEmail(auth, email);
      alert("تم ارسال رابط تغيير كلمة المرور لبريدك");
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(135deg,#0D3B66,#6a00a8)",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(480px,100%)",
          background: "white",
          borderRadius: 24,
          padding: 28,
          boxShadow: "0 20px 60px rgba(0,0,0,.25)",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 900,
            color: "#0D3B66",
          }}
        >
          حيّاك في مستوى
        </h1>

        <p style={{ marginTop: 8, opacity: 0.6 }}>
          {mode === "login"
            ? "سجل دخولك وابدأ اللعب"
            : "أنشئ حساب جديد وابدأ التحدي"}
        </p>

        {mode === "register" && (
          <input
            placeholder="اسمك"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        )}

        <input
          placeholder="اكتب ايميلك هنا"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%",
            height: 52,
            borderRadius: 14,
            border: "none",
            background: "#F4D35E",
            fontWeight: 900,
            fontSize: 16,
            cursor: "pointer",
            marginTop: 12,
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
          style={{
            width: "100%",
            height: 52,
            borderRadius: 14,
            border: "2px solid #0D3B66",
            background: "white",
            fontWeight: 900,
            marginTop: 12,
            cursor: "pointer",
          }}
        >
          تسجيل عبر Google
        </button>

        {mode === "login" && (
          <div
            style={{
              marginTop: 12,
              cursor: "pointer",
              color: "#6a00a8",
              fontWeight: 700,
            }}
            onClick={handleForgot}
          >
            نسيت كلمة المرور؟
          </div>
        )}

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            cursor: "pointer",
            fontWeight: 700,
            color: "#0D3B66",
          }}
          onClick={() =>
            setMode(mode === "login" ? "register" : "login")
          }
        >
          {mode === "login"
            ? "ما عندك حساب؟ أنشئ حساب"
            : "عندك حساب؟ تسجيل دخول"}
        </div>

        <div
          style={{
            marginTop: 18,
            fontSize: 12,
            opacity: 0.5,
            textAlign: "center",
          }}
        >
          باستخدامك للتطبيق فأنت توافق على الشروط والأحكام
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 48,
  borderRadius: 14,
  border: "1px solid #ddd",
  padding: "0 14px",
  marginTop: 12,
  fontSize: 15,
};