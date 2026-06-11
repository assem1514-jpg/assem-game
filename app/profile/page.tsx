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
  keys: number;
  gamesPlayed: number;
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
      navy: "#0D3B66",
      cream: "#FAF0CA",
      yellow: "#F4D35E",
      danger: "#ff4d6d",
    }),
    []
  );

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    const uid = user.uid;
    const fallbackName = (user.displayName || "").trim() || "لاعب";
    const fallbackEmail = (user.email || "").trim();

    (async () => {
      setBusy(true);

      try {
        const ref = doc(db, "players", uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
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

  async function handleLogout() {
    await signOut(auth);
    router.replace("/");
  }

  if (loading || busy) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: colors.navy,
          color: colors.cream,
          fontWeight: 900,
          direction: "rtl",
        }}
      >
        جاري تحميل البروفايل...
      </main>
    );
  }

  if (!data) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 18,
          background: colors.cream,
          direction: "rtl",
        }}
      >
        <section
          style={{
            width: "100%",
            maxWidth: 430,
            background: "#fff",
            borderRadius: 24,
            padding: 20,
            boxShadow: "0 18px 50px rgba(13,59,102,.14)",
            color: colors.navy,
            textAlign: "center",
            fontWeight: 900,
          }}
        >
          صار خطأ بقراءة بيانات البروفايل.

          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            <button
              onClick={() => router.refresh()}
              style={{
                minHeight: 52,
                borderRadius: 16,
                border: "none",
                background: colors.yellow,
                color: colors.navy,
                fontWeight: 1000,
                cursor: "pointer",
              }}
            >
              إعادة المحاولة
            </button>

            <Link
              href="/"
              style={{
                minHeight: 52,
                borderRadius: 16,
                border: `2px solid ${colors.navy}`,
                color: colors.navy,
                fontWeight: 1000,
                textDecoration: "none",
                display: "grid",
                placeItems: "center",
              }}
            >
              الرجوع للرئيسية
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const avatar = data.photoURL?.trim() ? data.photoURL : "";

  return (
    <main
      style={{
        minHeight: "100dvh",
        width: "100%",
        background: `linear-gradient(180deg, ${colors.navy} 0%, #082944 100%)`,
        padding: "22px 16px",
        boxSizing: "border-box",
        direction: "rtl",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 430,
          margin: "0 auto",
          display: "grid",
          gap: 14,
        }}
      >
        {/* بطاقة المستخدم */}
        <div
          style={{
            background: colors.cream,
            borderRadius: 30,
            padding: 20,
            boxShadow: "0 24px 70px rgba(0,0,0,.28)",
            border: "1px solid rgba(255,255,255,.22)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 30,
              background: colors.navy,
              margin: "0 auto 14px",
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
              boxShadow: "0 16px 36px rgba(13,59,102,.28)",
              border: `4px solid ${colors.yellow}`,
            }}
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt="avatar"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 1000,
                  color: colors.yellow,
                }}
              >
                {data.name?.trim()?.[0] || "م"}
              </span>
            )}
          </div>

          <h1
            style={{
              margin: 0,
              color: colors.navy,
              fontSize: 30,
              fontWeight: 1000,
              lineHeight: 1.2,
            }}
          >
            {data.name}
          </h1>

          <div
            style={{
              marginTop: 8,
              color: "rgba(13,59,102,.72)",
              fontSize: 14,
              fontWeight: 800,
              direction: "ltr",
              textAlign: "center",
              wordBreak: "break-word",
            }}
          >
            {data.email}
          </div>
        </div>

        {/* الإحصائيات */}
        <div
          style={{
            background: "#fff",
            borderRadius: 26,
            padding: 18,
            boxShadow: "0 16px 46px rgba(0,0,0,.18)",
          }}
        >
          <h2
            style={{
              margin: "0 0 14px",
              color: colors.navy,
              fontSize: 22,
              fontWeight: 1000,
            }}
          >
            إحصائياتك
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div
              style={{
                borderRadius: 20,
                padding: 14,
                background: "rgba(13,59,102,.06)",
                border: "2px solid rgba(13,59,102,.10)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  color: colors.navy,
                  fontWeight: 1000,
                  fontSize: 14,
                  lineHeight: 1.4,
                }}
              >
                عدد مرات اللعب
              </div>

              <div
                style={{
                  fontSize: 34,
                  fontWeight: 1000,
                  color: colors.navy,
                  marginTop: 6,
                }}
              >
                {data.gamesPlayed}
              </div>
            </div>

            <div
              style={{
                borderRadius: 20,
                padding: 14,
                background: "rgba(244,211,94,.38)",
                border: "2px solid rgba(13,59,102,.10)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  color: colors.navy,
                  fontWeight: 1000,
                  fontSize: 14,
                  lineHeight: 1.4,
                }}
              >
                رصيد المفاتيح
              </div>

              <div
                style={{
                  fontSize: 34,
                  fontWeight: 1000,
                  color: colors.navy,
                  marginTop: 6,
                }}
              >
                {data.keys}
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: "rgba(13,59,102,.62)",
              fontWeight: 800,
              lineHeight: 1.7,
            }}
          >
            * المفاتيح حالياً رصيد فقط، وبعدين نربطها بالشراء أو الدفع.
          </div>
        </div>

        {/* الحساب */}
        <div
          style={{
            background: "#fff",
            borderRadius: 26,
            padding: 18,
            boxShadow: "0 16px 46px rgba(0,0,0,.18)",
          }}
        >
          <h2
            style={{
              margin: "0 0 14px",
              color: colors.navy,
              fontSize: 22,
              fontWeight: 1000,
            }}
          >
            الحساب
          </h2>

          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                padding: 14,
                borderRadius: 18,
                border: "2px solid rgba(13,59,102,.10)",
                background: "rgba(13,59,102,.04)",
              }}
            >
              <div
                style={{
                  fontWeight: 1000,
                  color: colors.navy,
                  marginBottom: 6,
                  fontSize: 14,
                }}
              >
                اسم الحساب
              </div>

              <div style={{ fontWeight: 900, color: "#111" }}>{data.name}</div>
            </div>

            <div
              style={{
                padding: 14,
                borderRadius: 18,
                border: "2px solid rgba(13,59,102,.10)",
                background: "rgba(13,59,102,.04)",
              }}
            >
              <div
                style={{
                  fontWeight: 1000,
                  color: colors.navy,
                  marginBottom: 6,
                  fontSize: 14,
                }}
              >
                البريد الإلكتروني
              </div>

              <div
                style={{
                  fontWeight: 900,
                  color: "#111",
                  direction: "ltr",
                  textAlign: "right",
                  wordBreak: "break-word",
                }}
              >
                {data.email}
              </div>
            </div>
          </div>
        </div>

        {/* أزرار */}
        <div
          style={{
            display: "grid",
            gap: 10,
            background: "rgba(250,240,202,.10)",
            border: "1px solid rgba(250,240,202,.18)",
            borderRadius: 26,
            padding: 12,
            backdropFilter: "blur(10px)",
          }}
        >
          <Link
            href="/categories"
            style={{
              minHeight: 56,
              borderRadius: 18,
              background: colors.yellow,
              color: colors.navy,
              fontWeight: 1000,
              fontSize: 16,
              textDecoration: "none",
              display: "grid",
              placeItems: "center",
            }}
          >
            ابدأ لعبة
          </Link>

          <Link
            href="/"
            style={{
              minHeight: 54,
              borderRadius: 18,
              background: colors.cream,
              color: colors.navy,
              fontWeight: 1000,
              fontSize: 16,
              textDecoration: "none",
              display: "grid",
              placeItems: "center",
            }}
          >
            الرجوع للرئيسية
          </Link>

          <Link
            href="/privacy"
            style={{
              minHeight: 50,
              borderRadius: 18,
              border: "1px solid rgba(250,240,202,.28)",
              color: colors.cream,
              fontWeight: 900,
              fontSize: 14,
              textDecoration: "underline",
              display: "grid",
              placeItems: "center",
            }}
          >
            سياسة الخصوصية
          </Link>

          <button
            onClick={handleLogout}
            style={{
              minHeight: 54,
              borderRadius: 18,
              border: "none",
              background: colors.danger,
              color: "#fff",
              fontWeight: 1000,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            تسجيل خروج
          </button>
        </div>
      </section>
    </main>
  );
}