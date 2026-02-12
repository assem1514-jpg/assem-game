// app/categories/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";
import { collection, getDocs, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Icon } from "@iconify/react";

type Category = {
  id: string;
  name: string;
  imageUrl?: string;
  order?: number;
  group?: string;
  description?: string;
  questionsCount?: number;
};

const LS_KEY = "assem_game_v1";
const LS_PROGRESS_KEY = "assem_game_progress_v1";

type ProgressShape = {
  usedByCat?: Record<string, string[]>;
};

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
function loadProgress(): ProgressShape {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

type TeamInput = { name: string; icon: string };

const TEAM_ICONS = [
  { value: "mdi:account", label: "رجل" },
  { value: "mdi:account-woman", label: "امرأة" },
  { value: "mdi:crown", label: "تاج" },
  { value: "mdi:soccer", label: "كرة" },
  { value: "mdi:target", label: "هدف" },
  { value: "mdi:brain", label: "ذكاء" },
  { value: "mdi:lightning-bolt", label: "برق" },
  { value: "mdi:fire", label: "نار" },
  { value: "mdi:sword", label: "سيف" },
  { value: "mdi:shark", label: "قرش" },
  { value: "mdi:snake", label: "ثعبان" },
  { value: "mdi:dragon", label: "تنين" },
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string>("");

  const [teams, setTeams] = useState<TeamInput[]>([
    { name: "", icon: TEAM_ICONS[0].value },
    { name: "", icon: TEAM_ICONS[1].value },
  ]);

  const [pickerOpenFor, setPickerOpenFor] = useState<number | null>(null);
  const [infoOpenFor, setInfoOpenFor] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>("الكل");
  const [counts, setCounts] = useState<Record<string, number>>({});

  const progress = useMemo(() => loadProgress(), []);
  const usedByCat = progress?.usedByCat || {};

  useEffect(() => {
    const qCats = query(collection(db, "packs", "main", "categories"), orderBy("order", "asc"));

    const unsub = onSnapshot(
      qCats,
      async (snap) => {
        const rows: Category[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: (data.name ?? "").trim(),
            imageUrl: (data.imageUrl ?? "").trim(),
            order: data.order ?? 0,
            group: (data.group ?? "عام").trim(),
            description: (data.description ?? "").trim(),
            questionsCount: Number(data.questionsCount ?? 0) || undefined,
          };
        });

        setCategories(rows);

        setSelected((prev) => {
          const allowed = new Set(rows.map((r) => r.id));
          const next: Record<string, boolean> = {};
          Object.keys(prev).forEach((k) => {
            if (allowed.has(k) && prev[k]) next[k] = true;
          });
          return next;
        });

        const nextCounts: Record<string, number> = {};
        await Promise.all(
          rows.map(async (c) => {
            if (typeof c.questionsCount === "number") {
              nextCounts[c.id] = c.questionsCount;
              return;
            }
            try {
              const qs = await getDocs(collection(db, "packs", "main", "categories", c.id, "questions"));
              nextCounts[c.id] = qs.size || 0;
            } catch {
              nextCounts[c.id] = 0;
            }
          })
        );
        setCounts(nextCounts);
      },
      () => setCategories([])
    );

    const g = loadGame();
    if (g?.teams?.length) {
      const restored: TeamInput[] = g.teams.map((t: any, idx: number) => {
        const fallback = TEAM_ICONS[idx % TEAM_ICONS.length].value;
        const icon = typeof t?.icon === "string" && t.icon.includes(":") ? t.icon : fallback;
        return { name: t?.name ?? "", icon };
      });

      while (restored.length < 2) {
        restored.push({
          name: "",
          icon: TEAM_ICONS[restored.length % TEAM_ICONS.length].value,
        });
      }
      setTeams(restored);
    }

    return () => unsub();
  }, []);

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    categories.forEach((c) => set.add((c.group || "عام").trim() || "عام"));
    return ["الكل", ...Array.from(set)];
  }, [categories]);

  const visibleCategories = useMemo(() => {
    if (activeGroup === "الكل") return categories;
    return categories.filter((c) => (c.group || "عام") === activeGroup);
  }, [categories, activeGroup]);

  const selectedList = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as Category[];
  }, [selectedIds, categories]);

  function toggleCat(id: string) {
    setError("");
    setSelected((p) => {
      const on = !!p[id];
      if (!on && selectedIds.length >= 6) return p;
      return { ...p, [id]: !on };
    });
  }

  function removeSelected(id: string) {
    setSelected((p) => ({ ...p, [id]: false }));
  }

  function addTeamField() {
    setTeams((p) => [...p, { name: "", icon: TEAM_ICONS[p.length % TEAM_ICONS.length].value }]);
  }

  function updateTeamName(i: number, v: string) {
    setTeams((p) => p.map((x, idx) => (idx === i ? { ...x, name: v } : x)));
  }

  function setTeamIcon(i: number, icon: string) {
    setTeams((p) => p.map((x, idx) => (idx === i ? { ...x, icon } : x)));
    setPickerOpenFor(null);
  }

  function startGame() {
    setError("");

    const cleanedTeams = teams
      .map((t) => ({ name: t.name.trim(), icon: t.icon }))
      .filter((t) => Boolean(t.name));

    if (cleanedTeams.length < 2) {
      setError("لازم تضيف فريقين على الأقل.");
      return;
    }

    if (selectedIds.length !== 6) {
      setError("لازم تختار 6 فئات بالضبط عشان تبدأ.");
      return;
    }

    const game = {
      teams: cleanedTeams.map((t) => ({ name: t.name, icon: t.icon, score: 0 })),
      used: {},
      turnIndex: 0,
    };
    saveGame(game);

    const catsParam = selectedIds.join(",");
    window.location.href = `/game?cats=${encodeURIComponent(catsParam)}`;
  }

  function remainingText(catId: string) {
    const total = Number(counts[catId] || 0);
    const used = new Set((usedByCat?.[catId] || []).filter(Boolean)).size;

    const remaining = Math.max(0, total - used);
    if (total === 0) return "—";
    if (remaining === 0) return "مكتمل";
    return `الألعاب المتبقية: ${remaining}`;
  }

  const chosenCount = selectedIds.length;

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <Link className={styles.backBtn} href="/">
          ← الرئيسية
        </Link>
        <div className={styles.title}>اختيار الفئات</div>
        <div className={styles.spacer} />
      </header>

      <div className={styles.groupsBar}>
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setActiveGroup(g)}
            className={`${styles.groupChip} ${activeGroup === g ? styles.groupChipOn : ""}`}
          >
            {g}
          </button>
        ))}
      </div>

      <main className={styles.main}>
        <section className={styles.cats}>
          {visibleCategories.map((c) => {
            const on = !!selected[c.id];
            const desc = (c.description || "").trim();

            return (
              // ✅ بدل button: صار div قابل للنقر (عشان ما يصير زر داخل زر)
              <div
                key={c.id}
                className={`${styles.card} ${on ? styles.cardOn : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => toggleCat(c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleCat(c.id);
                  }
                }}
              >
                <button
                  type="button"
                  className={styles.infoBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    setInfoOpenFor(c.id);
                  }}
                  title="شرح الفئة"
                >
                  ?
                </button>

                <div className={styles.cardImage}>
                  {c.imageUrl ? <img src={c.imageUrl} alt={c.name} /> : <div className={styles.noImg}>صورة</div>}
                </div>

                <div className={styles.cardName}>{c.name}</div>

                <div className={styles.remainPill}>{remainingText(c.id)}</div>

                {infoOpenFor === c.id ? (
                  <div className={styles.infoOverlay} onClick={() => setInfoOpenFor(null)}>
                    <div className={styles.infoCard} onClick={(e) => e.stopPropagation()}>
                      <div className={styles.infoTitle}>شرح: {c.name}</div>
                      <div className={styles.infoText}>{desc || "—"}</div>
                      <button
                        className={styles.infoClose}
                        type="button"
                        onClick={() => setInfoOpenFor(null)}
                      >
                        إغلاق
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
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
              <div key={i} className={styles.teamRow}>
                <input
                  className={styles.teamInput}
                  placeholder={`اسم الفريق ${i + 1}`}
                  value={t.name}
                  onChange={(e) => updateTeamName(i, e.target.value)}
                />

                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => setPickerOpenFor((cur) => (cur === i ? null : i))}
                >
                  <Icon icon={t.icon} width="26" height="26" />
                </button>

                {pickerOpenFor === i ? (
                  <div className={styles.pickerOverlay} onClick={() => setPickerOpenFor(null)}>
                    <div className={styles.pickerCard} onClick={(e) => e.stopPropagation()}>
                      <div className={styles.pickerTitle}>اختر أيقونة</div>

                      <div className={styles.pickerGrid}>
                        {TEAM_ICONS.map((ic) => (
                          <button
                            key={ic.value}
                            type="button"
                            className={`${styles.pickerItem} ${t.icon === ic.value ? styles.pickerItemOn : ""}`}
                            onClick={() => setTeamIcon(i, ic.value)}
                          >
                            <Icon icon={ic.value} width="26" height="26" />
                            <span className={styles.pickerLabel}>{ic.label}</span>
                          </button>
                        ))}
                      </div>

                      <button className={styles.pickerClose} type="button" onClick={() => setPickerOpenFor(null)}>
                        إغلاق
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {error ? <div className={styles.error}>{error}</div> : null}

          <button className={styles.start} onClick={startGame} type="button">
            ابدأ
          </button>
        </section>
      </main>

      <div className={styles.selectedBar}>
        <div className={styles.selectedBarInner}>
          <div className={styles.selectedMeta}>
            <b>{chosenCount}/6</b>
            <span>الفئات المختارة</span>
          </div>

          <div className={styles.selectedPills}>
            {selectedList.length ? (
              selectedList.map((c) => (
                <button key={c.id} type="button" className={styles.selPill} onClick={() => removeSelected(c.id)}>
                  {c.name} ✕
                </button>
              ))
            ) : (
              <span className={styles.selectedHint}>اختر 6 فئات للبدء</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}