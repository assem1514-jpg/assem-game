"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";

import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/lib/authContext";

type PlayerDoc = {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  keys: number;        // رصيد المفاتيح
  gamesPlayed: number; // عدد مرات اللعب
  createdAt?: any;
  lastLoginAt?: any;
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [data, setData] = useState<PlayerDoc | null>(null);
  const [busy, setBusy] = useState(true);

  const colors = useMemo(
    () => ({
      navy: "var(--navy, #0D3B66)",
      cream: "var(--cream, #FAF0CA)",
      yellow: "var(--yellow, #F4D35E)",
    }),
    []
  );

  useEffect(() => {
    if (loading) return;

    // لو ما فيه مستخدم -> رجعه لتسجيل الدخول
    if (!user) {
      router.replace("/login");
      return;
    }

    const uid = user.uid; // ✅ نثبت uid هنا عشان ما يطلع خطأ
    const fallbackName = (user.displayName || "").trim() || "لاعب";
    const fallbackEmail = (user.email || "").trim();

    (async () => {
      setBusy(true);
      try {
        const ref = doc(db, "players", uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          // ✅ إنشاء وثيقة جديدة لو ما كانت موجودة
          const payload: PlayerDoc = {
            uid,
            name: fallbackName,
            email: fallbackEmail,
            photoURL: user.photoURL || "",
            keys: 0,
            gamesPlayed: 0,
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
          };
          await setDoc(ref, payload, { merge: true });
          setData(payload);
        } else {
          const d = snap.data() as Partial<PlayerDoc>;

          const normalized: PlayerDoc = {
            uid,
            name: (d.name || fallbackName) as string,
            email: (d.email || fallbackEmail) as string,
            photoURL: (d.photoURL || user.photoURL || "") as string,
            keys: Number(d.keys ?? 0),
            gamesPlayed: Number(d.gamesPlayed ?? 0),
            createdAt: d.createdAt,
            lastLoginAt: d.lastLoginAt,
          };

          // ✅ مزامنة أي قيم ناقصة
          await setDoc(
            ref,
            {
              name: normalized.name,
              email: normalized.email,
              photoURL: normalized.photoURL,
              keys: normalized.keys,
              gamesPlayed: normalized.gamesPlayed,
              lastLoginAt: serverTimestamp(),
            },
            { merge: true }
          );

          setData(normalized);
        }
      } catch (e) {
        console.error(e);
        setData(null);
      } finally {
        setBusy(false);
      }
    })();
  }, [loading, user, router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  if (loading || busy) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: colors.navy, color: "white" }}>
        جاري تحميل البروفايل...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ maxWidth: 520, width: "100%", background: "white", borderRadius: 18, padding: 18 }}>
          صار خطأ بقراءة بيانات البروفايل.
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => router.refresh()}
              style={{ padding: "12px 14px", borderRadius: 12, border: "none", background: colors.yellow, fontWeight: 900 }}
            >
              إعادة المحاولة
            </button>
            <Link
              href="/"
              style={{ padding: "12px 14px", borderRadius: 12, border: `2px solid ${colors.navy}`, fontWeight: 900, color: colors.navy }}
            >
              الرجوع للرئيسية
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const avatar = data.photoURL?.trim() ? data.photoURL : "";

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: `linear-gradient(135deg, ${colors.navy}, #093055)`,
        padding: 18,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          width: "min(880px, 100%)",
          background: "rgba(255,255,255,.10)",
          border: "1px solid rgba(255,255,255,.18)",
          borderRadius: 22,
          padding: 16,
          backdropFilter: "blur(10px)",
        }}
      >
        {/* Top */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 240 }}>
            <div
              style={{
                width: 62,
                height: 62,
                borderRadius: 18,
                background: "rgba(250,240,202,.20)",
                border: "2px solid rgba(250,240,202,.25)",
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                flex: "0 0 auto",
              }}
            >
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 22, fontWeight: 900, color: colors.cream }}>
                  {data.name?.trim()?.[0] || "م"}
                </span>
              )}
            </div>

            <div style={{ color: "white" }}>
              <div style={{ fontWeight: 900, fontSize: 20, lineHeight: 1.2 }}>{data.name}</div>
              <div style={{ opacity: 0.85, marginTop: 4, direction: "ltr", textAlign: "right" }}>{data.email}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href="/"
              style={{
                padding: "10px 14px",
                borderRadius: 14,
                border: "1px solid rgba(250,240,202,.35)",
                color: "white",
                textDecoration: "none",
                fontWeight: 900,
                background: "rgba(250,240,202,.10)",
              }}
            >
              الرجوع للرئيسية
            </Link>

            <Link
              href="/categories"
              style={{
                padding: "10px 14px",
                borderRadius: 14,
                border: "none",
                color: "#111",
                textDecoration: "none",
                fontWeight: 900,
                background: colors.yellow,
              }}
            >
              ابدأ لعبة
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12, marginTop: 14 }}>
          <div
            style={{
              gridColumn: "span 6",
              background: "white",
              borderRadius: 18,
              padding: 14,
              border: "2px solid rgba(13,59,102,.10)",
            }}
          >
            <div style={{ fontWeight: 900, color: colors.navy, marginBottom: 10 }}>إحصائياتك</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              <div
                style={{
                  borderRadius: 16,
                  padding: 12,
                  background: "rgba(13,59,102,.04)",
                  border: "2px solid rgba(13,59,102,.10)",
                }}
              >
                <div style={{ color: colors.navy, fontWeight: 900 }}>عدد مرات اللعب</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: colors.navy, marginTop: 6 }}>{data.gamesPlayed}</div>
              </div>

              <div
                style={{
                  borderRadius: 16,
                  padding: 12,
                  background: "rgba(244,211,94,.25)",
                  border: "2px solid rgba(13,59,102,.10)",
                }}
              >
                <div style={{ color: colors.navy, fontWeight: 900 }}>رصيد المفاتيح</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: colors.navy, marginTop: 6 }}>{data.keys}</div>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75, color: colors.navy }}>
              * المفاتيح حالياً رصيد فقط، وبعدين نربطها بالشراء/الدفع.
            </div>
          </div>

          <div
            style={{
              gridColumn: "span 6",
              background: "white",
              borderRadius: 18,
              padding: 14,
              border: "2px solid rgba(13,59,102,.10)",
            }}
          >
            <div style={{ fontWeight: 900, color: colors.navy, marginBottom: 10 }}>الحساب</div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 16, border: "2px solid rgba(13,59,102,.10)", background: "rgba(13,59,102,.04)" }}>
                <div style={{ fontWeight: 900, color: colors.navy, marginBottom: 6 }}>اسم الحساب</div>
                <div style={{ fontWeight: 800 }}>{data.name}</div>
              </div>

              <div style={{ padding: 12, borderRadius: 16, border: "2px solid rgba(13,59,102,.10)", background: "rgba(13,59,102,.04)" }}>
                <div style={{ fontWeight: 900, color: colors.navy, marginBottom: 6 }}>البريد الإلكتروني</div>
                <div style={{ fontWeight: 800, direction: "ltr", textAlign: "right" }}>{data.email}</div>
              </div>

              <button
                onClick={handleLogout}
                style={{
                  height: 48,
                  borderRadius: 16,
                  border: "none",
                  background: "#ff4d6d",
                  color: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                تسجيل خروج
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}