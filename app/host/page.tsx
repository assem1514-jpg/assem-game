"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function HostPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function createSession() {
    try {
      setLoading(true);

      const gameCode = generateCode();

      await addDoc(collection(db, "sessions"), {
        code: gameCode,
        status: "waiting",
        mode: "board",
        createdAt: Date.now(),
      });

      setCode(gameCode);
    } catch (error) {
      console.error(error);
      alert("صار خطأ أثناء إنشاء الجلسة");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0D3B66",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "#6E7FB2",
          borderRadius: "28px",
          padding: "32px 24px",
          textAlign: "center",
          color: "white",
        }}
      >
        <h1 style={{ fontSize: "48px", marginBottom: "28px", fontWeight: 800 }}>
          نبلش اللعب؟
        </h1>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              flex: 1,
              background: "#7C8CC0",
              borderRadius: "18px",
              padding: "22px 18px",
              fontSize: "32px",
              fontWeight: 800,
              color: "white",
            }}
          >
            {code || "----"}
          </div>

          <div style={{ fontSize: "30px", lineHeight: 1.4, textAlign: "right" }}>
            الكود
            <br />
            الخاص
            <br />
            باللعبة
          </div>
        </div>

        <button
          onClick={createSession}
          disabled={loading}
          style={{
            width: "100%",
            border: "none",
            borderRadius: "18px",
            padding: "22px",
            fontSize: "34px",
            fontWeight: 800,
            background: "#C98A58",
            color: "white",
            cursor: "pointer",
          }}
        >
          {loading ? "جاري الإنشاء..." : "بلش اللعب"}
        </button>
      </div>
    </main>
  );
}