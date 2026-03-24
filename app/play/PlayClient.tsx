"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { useAuth } from "@/lib/authContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";

export default function PlayChoosePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");

  const normalizedCode = useMemo(
    () => code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4),
    [code]
  );

  async function handleJoinByCode() {
    if (normalizedCode.length !== 4) {
      setErrorText("اكتب كود صحيح من 4 خانات");
      return;
    }

    try {
      setSubmitting(true);
      setErrorText("");

      const q = query(
        collection(db, "sessions"),
        where("code", "==", normalizedCode),
        where("isActive", "==", true),
        limit(1)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        setErrorText("الكود غير صحيح أو انتهت الجلسة");
        return;
      }

      const sessionDoc = snap.docs[0];
      const sessionData = sessionDoc.data() as any;

      const expiresAt = Number(sessionData?.expiresAt ?? 0);
      if (!expiresAt || Date.now() > expiresAt) {
        setErrorText("انتهت صلاحية هذا الكود");
        return;
      }

      const mode = String(sessionData?.mode || "");

      if (mode === "letters") {
        router.push(`/letters?session=${encodeURIComponent(normalizedCode)}`);
        return;
      }

      const cats = Array.isArray(sessionData?.gameData?.cats)
        ? sessionData.gameData.cats
        : [];

      if (!cats.length) {
        setErrorText("الجلسة موجودة لكن بيانات الفئات غير مكتملة");
        return;
      }

      router.push(
        `/game?cats=${encodeURIComponent(cats.join(","))}&session=${encodeURIComponent(normalizedCode)}`
      );
    } catch (error) {
      console.error(error);
      setErrorText("صار خطأ أثناء البحث عن الجلسة");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  if (!user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f8f1d7",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "min(420px, 100%)",
            background: "#fff",
            borderRadius: 24,
            padding: 24,
            boxShadow: "0 20px 50px rgba(0,0,0,.12)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 900,
              color: "#0d3b66",
              marginBottom: 16,
            }}
          >
            لازم تسجل دخول
          </div>

          <Link
            href="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 180,
              height: 52,
              borderRadius: 16,
              background: "#0d3b66",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 900,
              fontSize: 16,
            }}
          >
            تسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#0d3b66 0%, #132f52 100%)",
        padding: 24,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          width: "min(760px, 100%)",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 28,
          padding: 28,
          boxShadow: "0 20px 60px rgba(0,0,0,.22)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            marginBottom: 28,
            direction: "rtl",
          }}
        >
          <img
            src="/logo.png"
            alt="logo"
            style={{
              width: 86,
              height: 86,
              objectFit: "contain",
            }}
          />

          <div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 1000,
                color: "#fff",
                lineHeight: 1.1,
              }}
            >
              أدخل كود اللعبة
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#f4d35e",
                marginTop: 6,
              }}
            >
              اكتب الكود المكون من 4 خانات لعرض اللعبة المناسبة
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 24,
            padding: 24,
            boxShadow: "0 12px 30px rgba(0,0,0,.14)",
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "#0d3b66",
              marginBottom: 14,
              textAlign: "right",
            }}
          >
            كود الجلسة
          </div>

          <input
            value={normalizedCode}
            onChange={(e) => {
              setCode(e.target.value);
              if (errorText) setErrorText("");
            }}
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={4}
            placeholder="مثال: QP8B"
            style={{
              width: "100%",
              height: 64,
              borderRadius: 18,
              border: "2px solid #d7dee8",
              outline: "none",
              padding: "0 18px",
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: 6,
              textAlign: "center",
              color: "#0d3b66",
              marginBottom: 14,
            }}
          />

          {errorText ? (
            <div
              style={{
                color: "#c1121f",
                fontWeight: 800,
                marginBottom: 14,
                textAlign: "center",
              }}
            >
              {errorText}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleJoinByCode}
            disabled={submitting}
            style={{
              width: "100%",
              height: 58,
              borderRadius: 18,
              border: "none",
              background: "#0d3b66",
              color: "#fff",
              fontSize: 20,
              fontWeight: 900,
              cursor: submitting ? "default" : "pointer",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "جاري الدخول..." : "دخول"}
          </button>
        </div>

        <div
          style={{
            marginTop: 22,
            display: "flex",
            justifyContent: "flex-start",
          }}
        >
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
              background: "rgba(255,255,255,.12)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,.16)",
              borderRadius: 14,
              padding: "12px 16px",
              fontWeight: 900,
            }}
          >
            <Icon icon="mdi:arrow-right" width={18} height={18} />
            رجوع للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}