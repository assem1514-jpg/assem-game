"use client";

import Link from "next/link";
import styles from "./page.module.css";
import { Gamepad2 } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { useAuth } from "@/lib/authContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) return null;

  const playHref = user ? "/categories" : "/login";

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.overlay}>

          {/* ===== زر العب (يمين فوق) ===== */}
          <div className={styles.playWrapper}>
            <Link className={styles.playBtn} href={playHref}>
              <span>العب</span>
              <Gamepad2 size={20} />
            </Link>
          </div>

          {/* ===== القائمة اليسار ===== */}
          <div className={styles.menuWrapper}>

            {!user ? (
              <Link className={styles.menuBtn} href="/login">
                تسجيل الدخول
              </Link>
            ) : (
              <div className={styles.profileBox}>
                <div className={styles.profileName}>
                  {user.displayName || user.email}
                </div>
                <button className={styles.logoutBtn} onClick={handleLogout}>
                  تسجيل خروج
                </button>
              </div>
            )}

            <a
              className={styles.menuBtn}
              href="https://wa.me/966559546504"
              target="_blank"
              rel="noreferrer"
            >
              تواصل معنا
              <FaWhatsapp size={18} />
            </a>

            <Link className={styles.menuBtn} href="/store">
              المتجر
            </Link>

          </div>
        </div>
      </div>
    </div>
  );
}