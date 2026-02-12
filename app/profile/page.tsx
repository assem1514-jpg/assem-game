"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import Image from "next/image";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) return null;

  if (!user) {
    router.push("/login");
    return null;
  }

  async function handleLogout() {
    await signOut(auth);
    router.push("/");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#faf0ca",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 24,
          padding: 30,
          width: "100%",
          maxWidth: 420,
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,.15)",
        }}
      >
        <Image
          src="/logo.png"
          alt="مستوى"
          width={100}
          height={100}
          style={{ marginBottom: 20 }}
        />

        <h2 style={{ color: "#0d3b66", marginBottom: 10 }}>
          {user.displayName || "مستخدم مستوى"}
        </h2>

        <p style={{ color: "#555", marginBottom: 30 }}>
          {user.email}
        </p>

        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "#0d3b66",
            color: "#faf0ca",
            borderRadius: 14,
            border: "none",
            fontWeight: 900,
            cursor: "pointer",
            marginBottom: 12,
          }}
        >
          تسجيل خروج
        </button>

        <button
          onClick={() => router.push("/")}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "#f4d35e",
            color: "#0d3b66",
            borderRadius: 14,
            border: "none",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          الرجوع للرئيسية
        </button>
      </div>
    </div>
  );
}