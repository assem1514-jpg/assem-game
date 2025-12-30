"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Team = { name: string; score: number };

type Category = {
  id: string;
  name: string;
  imageUrl?: string;
  order?: number;
};

const LS_KEY = "assem_game_v1";

function loadGame() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveGame(data: any) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [teams, setTeams] = useState<string[]>(["", ""]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    // ✅ تحميل الفئات من نفس مكان الأدمن الحقيقي: packs/main/categories
    const qCats = query(
      collection(db, "packs", "main", "categories"),
      orderBy("order", "asc")
    );

    const unsub = onSnapshot(
      qCats,
      (snap) => {
        const rows: Category[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name ?? "",
            imageUrl: data.imageUrl ?? "",
            order: data.order ?? 0,
          };
        });

        setCategories(rows);

        // ✅ فلترة أي اختيارات قديمة غير موجودة
        setSelected((prev) => {
          const allowed = new Set(rows.map((r) => r.id));
          const next: Record<string, boolean> = {};
          Object.keys(prev).forEach((k) => {
            if (allowed.has(k) && prev[k]) next[k] = true;
          });
          return next;
        });
      },
      (err) => {
        console.error(err);
        setCategories([]);
      }
    );

    // ✅ استرجاع أسماء الفرق فقط (بدون selectedCategories عشان ما تجيك فئات قديمة)
    const g = loadGame();
    if (g?.teams?.length) setTeams(g.teams.map((t: Team) => t.name));

    return () => unsub();
  }, []);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected]
  );

  function toggleCat(id: string) {
    setSelected((p) => ({ ...p, [id]: !p[id] }));
  }

  function addTeamField() {
    setTeams((p) => [...p, ""]);
  }

  function updateTeam(i: number, v: string) {
    setTeams((p) => p.map((x, idx) => (idx === i ? v : x)));
  }

  function startGame() {
    setError("");

    const cleanedTeams = teams.map((t) => t.trim()).filter(Boolean);
    if (cleanedTeams.length < 2) {
      setError("لازم تضيف فريقين على الأقل.");
      return;
    }
    if (selectedIds.length < 1) {
      setError("اختر فئة واحدة على الأقل.");
      return;
    }

    const game = {
      teams: cleanedTeams.map((name) => ({ name, score: 0 })),
      used: {},
      turnIndex: 0,
    };
    saveGame(game);

    const catsParam = selectedIds.join(",");
    window.location.href = `/game?cats=${encodeURIComponent(catsParam)}`;
  }

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <Link className={styles.backBtn} href="/">
          ← الرئيسية
        </Link>
        <div className={styles.title}>اختيار الفئات</div>
        <div className={styles.spacer} />
      </header>

      <main className={styles.main}>
        <section className={styles.cats}>
          {categories.map((c) => {
            const on = !!selected[c.id];
            return (
              <button
                key={c.id}
                className={`${styles.card} ${on ? styles.cardOn : ""}`}
                onClick={() => toggleCat(c.id)}
                type="button"
              >
                <div className={styles.cardImage}>
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt={c.name} />
                  ) : (
                    <div className={styles.noImg}>صورة</div>
                  )}
                </div>
                <div className={styles.cardName}>{c.name}</div>
              </button>
            );
          })}
        </section>

        <section className={styles.teams}>
          <div className={styles.teamsHeader}>
            <div className={styles.teamsTitle}>أسماء الفرق</div>
            <button className={styles.addTeam} onClick={addTeamField} type="button">
              + إضافة فريق
            </button>
          </div>

          <div className={styles.teamsGrid}>
            {teams.map((t, i) => (
              <input
                key={i}
                className={styles.teamInput}
                placeholder={`اسم الفريق ${i + 1}`}
                value={t}
                onChange={(e) => updateTeam(i, e.target.value)}
              />
            ))}
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}

          <button className={styles.start} onClick={startGame} type="button">
            ابدأ
          </button>
        </section>
      </main>
    </div>
  );
}