// app/page.tsx
import Link from "next/link";
import styles from "./page.module.css";
import { Gamepad2 } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";

export default function HomePage() {
  return (
    <div className={styles.page}>
      <div className={styles.hero} role="img" aria-label="Assem Game Home">
        <div className={styles.overlay}>
          <div className={styles.left}>
            <Link className={styles.playBtn} href="/categories">
              <span className={styles.playText}>العب</span>
              <span className={styles.playIcon} aria-hidden="true">
                <Gamepad2 size={22} />
              </span>
            </Link>
          </div>

          <div className={styles.right}>
            <Link className={styles.menuBtn} href="/login">
              تسجيل الدخول
            </Link>

            <a
              className={styles.menuBtn}
              href="https://wa.me/"
              target="_blank"
              rel="noreferrer"
            >
              تواصل معنا
              <span className={styles.waIcon} aria-hidden="true">
                <FaWhatsapp size={18} />
              </span>
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