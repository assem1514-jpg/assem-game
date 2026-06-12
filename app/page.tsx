// app/page.tsx
"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Gamepad2,
  Hash,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
} from "lucide-react";

const COLORS = {
  navy: "#0D3B66",
  cream: "#FAF0CA",
  yellow: "#F4D35E",
};

export default function HomePage() {
  const router = useRouter();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function cleanCode(value: string) {
    return value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4);
  }

  async function joinGame(e: FormEvent) {
    e.preventDefault();

    const finalCode = cleanCode(code);

    if (finalCode.length !== 4) {
      setError("اكتب كود اللعبة المكون من 4 خانات");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const q = query(
        collection(db, "sessions"),
        where("code", "==", finalCode),
        where("isActive", "==", true),
        limit(1)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        setError("الكود غير صحيح أو انتهت الجلسة");
        setLoading(false);
        return;
      }

      const sessionData = snap.docs[0].data() as any;
      const expiresAt = Number(sessionData?.expiresAt ?? 0);

      if (expiresAt && Date.now() > expiresAt) {
        setError("انتهت صلاحية كود اللعبة");
        setLoading(false);
        return;
      }

      router.push(`/game?session=${encodeURIComponent(finalCode)}`);
    } catch (err) {
      console.error(err);
      setError("تعذر التحقق من الكود، تأكد من الاتصال بالإنترنت");
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background:
          "radial-gradient(circle at 16% 12%, rgba(244,211,94,.55), transparent 30%), radial-gradient(circle at 84% 18%, rgba(13,59,102,.22), transparent 30%), linear-gradient(135deg, #FAF0CA, #fff8dc)",
        color: COLORS.navy,
        direction: "rtl",
        display: "grid",
        placeItems: "center",
        padding: 18,
        boxSizing: "border-box",
      }}
    >
      <section
        style={{
          width: "min(1120px, 100%)",
          display: "grid",
          gridTemplateColumns: "minmax(0, .92fr) minmax(380px, .72fr)",
          gap: 22,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            background: COLORS.navy,
            color: COLORS.cream,
            borderRadius: 34,
            padding: 28,
            boxShadow: "0 24px 70px rgba(13,59,102,.22)",
            border: "1px solid rgba(250,240,202,.18)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 260,
              height: 260,
              borderRadius: 999,
              background: "rgba(244,211,94,.18)",
              top: -90,
              left: -80,
            }}
          />

          <div
            style={{
              position: "absolute",
              width: 180,
              height: 180,
              borderRadius: 999,
              background: "rgba(250,240,202,.10)",
              bottom: -70,
              right: -50,
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div
              style={{
                width: 126,
                height: 126,
                borderRadius: 34,
                background: "rgba(250,240,202,.10)",
                border: "1px solid rgba(250,240,202,.18)",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 18px 44px rgba(0,0,0,.16)",
                overflow: "hidden",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="مستوى"
                style={{
                  width: "86%",
                  height: "86%",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </div>

            <div
              style={{
                marginTop: 22,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(244,211,94,.16)",
                color: COLORS.yellow,
                border: "1px solid rgba(244,211,94,.30)",
                borderRadius: 999,
                padding: "8px 12px",
                fontSize: 14,
                fontWeight: 1000,
              }}
            >
              <Sparkles size={17} />
              بوابة الانضمام الرسمية
            </div>

            <h1
              style={{
                margin: "18px 0 0",
                fontSize: "clamp(34px, 5vw, 62px)",
                fontWeight: 1000,
                lineHeight: 1.08,
                letterSpacing: "-1px",
              }}
            >
              دخل كود اللعبة
              <br />
              وخل التحدي يبدأ
            </h1>

            <p
              style={{
                margin: "18px 0 0",
                maxWidth: 560,
                fontSize: 19,
                fontWeight: 800,
                lineHeight: 1.9,
                color: "rgba(250,240,202,.82)",
              }}
            >
              إذا المضيف عطاك كود مستوى، اكتبه هنا وادخل مباشرة على لوحة
              اللعبة. بدون تسجيل، بدون تعقيد.
            </p>

            <div
              style={{
                marginTop: 26,
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              <InfoCard
                icon={<Smartphone size={23} />}
                title="المضيف يبدأ"
                text="من التطبيق يختار الفئات ويطلع الكود."
              />

              <InfoCard
                icon={<Hash size={23} />}
                title="تدخل الكود"
                text="اكتب الأربع خانات مثل ما هي."
              />

              <InfoCard
                icon={<Gamepad2 size={23} />}
                title="تبدأ المنافسة"
                text="الأسئلة، النقاط، والفائز بالنهاية."
              />
            </div>

            <div
              style={{
                marginTop: 22,
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                color: "rgba(250,240,202,.74)",
                fontSize: 14,
                fontWeight: 900,
              }}
            >
              <MiniFeature icon={<Users size={16} />} text="مناسب للجلسات والتجمعات" />
              <MiniFeature icon={<ShieldCheck size={16} />} text="كود مؤقت لكل لعبة" />
            </div>
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,.82)",
            border: "1px solid rgba(13,59,102,.12)",
            borderRadius: 34,
            padding: 24,
            boxShadow: "0 24px 70px rgba(13,59,102,.18)",
            backdropFilter: "blur(12px)",
            display: "grid",
            alignContent: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 76,
                height: 76,
                margin: "0 auto 14px",
                borderRadius: 24,
                background: COLORS.yellow,
                color: COLORS.navy,
                display: "grid",
                placeItems: "center",
                boxShadow: "0 16px 34px rgba(244,211,94,.38)",
              }}
            >
              <Hash size={38} strokeWidth={3} />
            </div>

            <h2
              style={{
                margin: 0,
                fontSize: 34,
                fontWeight: 1000,
                lineHeight: 1.2,
              }}
            >
              انضم للعبة
            </h2>

            <p
              style={{
                margin: "10px auto 0",
                maxWidth: 360,
                fontSize: 16,
                fontWeight: 800,
                color: "rgba(13,59,102,.68)",
                lineHeight: 1.8,
              }}
            >
              الكود يطلع عند صاحب اللعبة. اكتبه هنا وبتدخل على طول.
            </p>
          </div>

          <form onSubmit={joinGame} style={{ marginTop: 24 }}>
            <label
              style={{
                display: "block",
                fontWeight: 1000,
                marginBottom: 10,
                fontSize: 15,
              }}
            >
              كود اللعبة
            </label>

            <input
              value={code}
              onChange={(e) => {
                setCode(cleanCode(e.target.value));
                setError("");
              }}
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              maxLength={4}
              placeholder="A7K2"
              style={{
                width: "100%",
                height: 72,
                borderRadius: 22,
                border: `3px solid ${COLORS.navy}`,
                background: "#fff",
                color: COLORS.navy,
                boxSizing: "border-box",
                textAlign: "center",
                direction: "ltr",
                fontSize: 36,
                fontWeight: 1000,
                letterSpacing: 10,
                outline: "none",
                textTransform: "uppercase",
                boxShadow: "inset 0 2px 0 rgba(13,59,102,.04)",
              }}
            />

            {error && (
              <div
                style={{
                  marginTop: 12,
                  padding: "12px 14px",
                  borderRadius: 16,
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
              type="submit"
              disabled={loading}
              style={{
                marginTop: 16,
                width: "100%",
                minHeight: 64,
                borderRadius: 22,
                border: "none",
                background: COLORS.yellow,
                color: COLORS.navy,
                fontSize: 21,
                fontWeight: 1000,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 14px 30px rgba(244,211,94,.34)",
              }}
            >
              {loading ? "جارٍ التحقق..." : "انضمام"}
            </button>
          </form>

          <div
            style={{
              marginTop: 18,
              padding: "14px 16px",
              borderRadius: 20,
              background: "rgba(13,59,102,.06)",
              border: "1px solid rgba(13,59,102,.10)",
              color: "rgba(13,59,102,.72)",
              fontSize: 14,
              fontWeight: 900,
              lineHeight: 1.7,
              textAlign: "center",
            }}
          >
            ملاحظة: إنشاء اللعبة وإدارة الأسئلة تكون من تطبيق مستوى فقط.
          </div>

          <footer
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: "1px solid rgba(13,59,102,.10)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              fontSize: 13,
              fontWeight: 900,
              color: "rgba(13,59,102,.58)",
            }}
          >
            <a
              href="https://wa.me/966559546504"
              target="_blank"
              rel="noreferrer"
              style={{
                color: "rgba(13,59,102,.68)",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <MessageCircle size={14} />
              الدعم
            </a>

            <span style={{ opacity: 0.45 }}>•</span>

            <Link
              href="/privacy"
              style={{
                color: "rgba(13,59,102,.68)",
                textDecoration: "none",
              }}
            >
              سياسة الخصوصية
            </Link>
          </footer>
        </div>
      </section>

      <style jsx>{`
        @media (max-width: 900px) {
          section {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 560px) {
          main {
            padding: 12px !important;
            place-items: start center !important;
          }

          section {
            gap: 14px !important;
          }
        }
      `}</style>
    </main>
  );
}

function InfoCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div
      style={{
        background: "rgba(250,240,202,.10)",
        border: "1px solid rgba(250,240,202,.18)",
        borderRadius: 20,
        padding: 14,
        minHeight: 112,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 15,
          background: "rgba(244,211,94,.18)",
          color: COLORS.yellow,
          display: "grid",
          placeItems: "center",
          marginBottom: 10,
        }}
      >
        {icon}
      </div>

      <div
        style={{
          fontSize: 15,
          fontWeight: 1000,
          color: COLORS.cream,
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop: 5,
          fontSize: 13,
          fontWeight: 800,
          lineHeight: 1.6,
          color: "rgba(250,240,202,.70)",
        }}
      >
        {text}
      </div>
    </div>
  );
}

function MiniFeature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "rgba(250,240,202,.09)",
        border: "1px solid rgba(250,240,202,.14)",
        borderRadius: 999,
        padding: "8px 11px",
      }}
    >
      {icon}
      {text}
    </span>
  );
}