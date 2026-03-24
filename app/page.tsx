"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

import { useAuth } from "@/lib/authContext";
import { User, Gamepad2, Store, MessageCircle, ChevronLeft, LogIn } from "lucide-react";

type TabKey = "account" | "games" | "store";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<TabKey>("games");

  const isAuthed = useMemo(() => !!user, [user]);

  function goToPlay(path: string) {
    if (!isAuthed) {
      router.push("/login");
      return;
    }
    router.push(path);
  }

  if (loading) return null;

  return (
    <div className={styles.page}>
      <div className={styles.appShell}>
        {/* الهيدر */}
        <header className={styles.header}>
          <button
            type="button"
            className={styles.headerIconBtn}
            onClick={() => setTab("account")}
            title="الحساب"
          >
            <User size={22} />
          </button>

          <div className={styles.headerCenter}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="مستوى" className={styles.headerLogo} />
          </div>

          <div className={styles.headerSpacer} />
        </header>

        {/* المحتوى */}
        <main className={styles.content}>
          {tab === "games" && (
            <section className={styles.section}>
              <div className={styles.cardsGrid}>
                <button
                  type="button"
                  className={styles.gameCard}
                  onClick={() => goToPlay("/categories")}
                >
                  <div className={styles.cardImageWrap}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.cardImage}
                      src="/pick-questions.png"
                      alt="سؤال وجواب"
                    />
                  </div>
                  <div className={styles.cardBadge}>سؤال وجواب</div>
                </button>

                <button
                  type="button"
                  className={styles.gameCard}
                  onClick={() => goToPlay("/letters")}
                >
                  <div className={styles.cardImageWrap}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={styles.cardImage}
                      src="/pick-letters.png"
                      alt="خلية الحروف"
                    />
                  </div>
                  <div className={styles.cardBadge}>خلية الحروف</div>
                </button>
              </div>
            </section>
          )}

          {tab === "account" && (
            <section className={styles.section}>
              <div className={styles.menuList}>
                {!isAuthed ? (
                  <Link href="/login" className={styles.menuItem}>
                    <div className={styles.menuItemRight}>
                      <div className={styles.menuIcon}>
                        <LogIn size={20} />
                      </div>
                      <div>
                        <div className={styles.menuTitle}>تسجيل الدخول</div>
                        <div className={styles.menuSub}>سجل دخولك للوصول إلى اللعب والبروفايل</div>
                      </div>
                    </div>
                    <ChevronLeft size={18} />
                  </Link>
                ) : (
                  <Link href="/profile" className={styles.menuItem}>
                    <div className={styles.menuItemRight}>
                      <div className={styles.menuIcon}>
                        <User size={20} />
                      </div>
                      <div>
                        <div className={styles.menuTitle}>البروفايل</div>
                        <div className={styles.menuSub}>الملف الشخصي، الإحصائيات، والحساب</div>
                      </div>
                    </div>
                    <ChevronLeft size={18} />
                  </Link>
                )}

                <a
                  href="https://wa.me/966559546504"
                  target="_blank"
                  rel="noreferrer"
                  className={styles.menuItem}
                >
                  <div className={styles.menuItemRight}>
                    <div className={styles.menuIcon}>
                      <MessageCircle size={20} />
                    </div>
                    <div>
                      <div className={styles.menuTitle}>تواصل معنا</div>
                      <div className={styles.menuSub}>راسلنا عبر واتساب لأي استفسار أو دعم</div>
                    </div>
                  </div>
                  <ChevronLeft size={18} />
                </a>
              </div>
            </section>
          )}

          {tab === "store" && (
            <section className={styles.section}>
              <div className={styles.storeBox}>
                <div className={styles.storeIconWrap}>
                  <Store size={28} />
                </div>
                <div className={styles.storeTitle}>المتجر</div>
                <div className={styles.storeSub}>قريبًا بإذن الله</div>

                <Link href="/store" className={styles.storeBtn}>
                  فتح صفحة المتجر
                </Link>
              </div>
            </section>
          )}
        </main>

        {/* شريط التنقل السفلي */}
        <nav className={styles.bottomNav}>
          <button
            type="button"
            className={`${styles.navItem} ${tab === "account" ? styles.navItemActive : ""}`}
            onClick={() => setTab("account")}
          >
            <User size={24} />
            <span>الحساب</span>
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${tab === "games" ? styles.navItemActive : ""}`}
            onClick={() => setTab("games")}
          >
            <Gamepad2 size={24} />
            <span>الألعاب</span>
          </button>

          <button
            type="button"
            className={`${styles.navItem} ${tab === "store" ? styles.navItemActive : ""}`}
            onClick={() => setTab("store")}
          >
            <Store size={24} />
            <span>المتجر</span>
          </button>
        </nav>
      </div>
    </div>
  );
}