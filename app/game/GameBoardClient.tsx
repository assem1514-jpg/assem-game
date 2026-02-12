// app/game/GameBoardClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./page.module.css";

import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, documentId } from "firebase/firestore";
import { Icon } from "@iconify/react";

type Team = { name: string; score: number; icon?: string };
type CatMeta = { id: string; name: string; imageUrl?: string };

const LS_KEY = "assem_game_v1";

// ✅ 6 خلايا: 2x600 ثم 2x400 ثم 2x200 (من فوق لتحت)
const POINTS_ROWS: number[] = [600, 600, 400, 400, 200, 200];

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

function normalizeCatsParam(input: string) {
  let s = input || "";
  s = s.replace(/%2C/gi, ",");
  try {
    const once = decodeURIComponent(s);
    s = once.replace(/%2C/gi, ",");
  } catch {}
  return s;
}

function renderTeamIcon(icon?: string, size = 18) {
  if (!icon) return null;
  // إذا كانت Iconify id مثل "mdi:soccer"
  if (typeof icon === "string" && icon.includes(":")) {
    return <Icon icon={icon} width={size} height={size} />;
  }
  // لو كان شيء قديم (ايموجي)
  return <span>{icon}</span>;
}

export default function GameBoardClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const rawCats = normalizeCatsParam(sp.get("cats") || "");

  // ✅ إزالة أي تكرار في catIds (عشان ما تتكرر أعمدة)
  const catIds = useMemo(() => {
    const arr = rawCats
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const seen = new Set<string>();
    const unique: string[] = [];
    for (const id of arr) {
      if (!seen.has(id)) {
        seen.add(id);
        unique.push(id);
      }
    }
    return unique;
  }, [rawCats]);

  const [game, setGame] = useState(() => loadGame());
  const [catsMeta, setCatsMeta] = useState<Record<string, CatMeta>>({});

  // ✅ هل توجد خلية فعلاً؟ + ربط كل خلية بـ questionId ثابت
  const [hasQuestion, setHasQuestion] = useState<Record<string, boolean>>({});
  const [qidByCell, setQidByCell] = useState<Record<string, string>>({});

  // ✅ مهم: نعرف متى "تحميل الأسئلة" اكتمل فعلاً (عشان لا تظهر النهاية أول ما نفتح اللوحة)
  const [questionsReady, setQuestionsReady] = useState(false);

  // ✅ نهاية اللعبة (بوديوم)
  const [showEnd, setShowEnd] = useState(false);

  // ✅ جلب ميتا الفئات (الاسم + الصورة)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!catIds.length) {
        setCatsMeta({});
        return;
      }

      const buildMap = (snap: any) => {
        const map: Record<string, CatMeta> = {};
        snap.docs.forEach((d: any) => {
          const data = d.data?.() ?? {};
          map[d.id] = {
            id: d.id,
            name: (data.name ?? data.title ?? data.catName ?? "").toString().trim(),
            imageUrl: (data.imageUrl ?? data.image ?? data.photoUrl ?? "").toString().trim(),
          };
        });
        return map;
      };

      try {
        const q1 = query(
          collection(db, "packs", "main", "categories"),
          where(documentId(), "in", catIds.slice(0, 10))
        );
        const snap1 = await getDocs(q1);
        let map = buildMap(snap1);

        // fallback
        const missing = catIds.filter((id) => !(map[id]?.name || "").trim());
        if (missing.length) {
          const q2 = query(collection(db, "categories"), where(documentId(), "in", missing.slice(0, 10)));
          const snap2 = await getDocs(q2);
          map = { ...map, ...buildMap(snap2) };
        }

        if (!cancelled) setCatsMeta(map);
      } catch (e) {
        console.error(e);
        if (!cancelled) setCatsMeta({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catIds.join("|")]);

  // ✅ بناء hasQuestion + qidByCell من الأسئلة الحقيقية
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setQuestionsReady(false);

      if (!catIds.length) {
        setHasQuestion({});
        setQidByCell({});
        setQuestionsReady(true);
        return;
      }

      try {
        const hasMap: Record<string, boolean> = {};
        const idMap: Record<string, string> = {};

        for (const catId of catIds) {
          const snap = await getDocs(collection(db, "packs", "main", "categories", catId, "questions"));

          const bucket: Record<number, string[]> = { 200: [], 400: [], 600: [] };

          snap.forEach((d) => {
            const data = d.data() as any;
            const pts = Number(data.points || 0);
            if (![200, 400, 600].includes(pts)) return;
            bucket[pts].push(d.id);
          });

          // ✅ اختيار ثابت: sort by id
          for (const pts of [200, 400, 600] as const) {
            const ids = (bucket[pts] || []).slice().sort();
            if (ids[0]) {
              const key0 = `${catId}:${pts}:0`;
              hasMap[key0] = true;
              idMap[key0] = ids[0];
            }
            if (ids[1]) {
              const key1 = `${catId}:${pts}:1`;
              hasMap[key1] = true;
              idMap[key1] = ids[1];
            }
          }
        }

        if (!cancelled) {
          setHasQuestion(hasMap);
          setQidByCell(idMap);
          setQuestionsReady(true);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setHasQuestion({});
          setQidByCell({});
          setQuestionsReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catIds.join("|")]);

  function isUsed(catId: string, pts: number, idx: number) {
    return !!game?.used?.[`${catId}:${pts}:${idx}`];
  }

  function canOpen(catId: string, pts: number, idx: number) {
    return !!hasQuestion[`${catId}:${pts}:${idx}`];
  }

  // ✅ عدد الخلايا المتاحة فعلياً (لو = 0 ما نعتبر اللعبة "انتهت")
  const availableCellsCount = useMemo(() => Object.keys(hasQuestion).length, [hasQuestion]);

  // ✅ هل انتهت كل الخلايا؟
  const allCellsDone = useMemo(() => {
    if (!questionsReady) return false;
    if (!game || !catIds.length) return false;
    if (availableCellsCount === 0) return false;

    for (const catId of catIds) {
      for (const pts of [200, 400, 600] as const) {
        for (const idx of [0, 1] as const) {
          const key = `${catId}:${pts}:${idx}`;
          const available = !!hasQuestion[key];
          if (available) {
            const used = !!game?.used?.[key];
            if (!used) return false;
          }
        }
      }
    }
    return true;
  }, [questionsReady, game, catIds.join("|"), hasQuestion, availableCellsCount]);

  useEffect(() => {
    if (!game) return;
    if (questionsReady && allCellsDone) setShowEnd(true);
  }, [questionsReady, allCellsDone, game]);

  function openQuestion(catId: string, pts: number, idx: number) {
    if (!game) return;
    const key = `${catId}:${pts}:${idx}`;
    const qid = qidByCell[key] || "";

    router.push(
      `/game/question?cat=${encodeURIComponent(catId)}&pts=${pts}&idx=${idx}&qid=${encodeURIComponent(
        qid
      )}&cats=${encodeURIComponent(catIds.join(","))}`
    );
  }

  function changeScore(teamIndex: number, delta: number) {
    if (!game) return;
    const updated = { ...game };
    updated.teams = (updated.teams || []).map((t: Team, i: number) =>
      i === teamIndex ? { ...t, score: Math.max(0, (t.score || 0) + delta) } : t
    );
    saveGame(updated);
    setGame(updated);
  }

  // ✅ زر تبديل الفريق (داخل دور الفريق)
  function switchTeam() {
    if (!game) return;
    const teamsCount = Number(game?.teams?.length || 0);
    if (teamsCount <= 1) return;

    const updated = { ...game };
    const cur = Number(updated.turnIndex || 0);
    updated.turnIndex = (cur + 1) % teamsCount;

    saveGame(updated);
    setGame(updated);
  }

  function finishAndGoHome() {
    localStorage.removeItem(LS_KEY);
    router.push("/");
  }

  function restartGame() {
    router.push("/categories");
  }

  const podium = useMemo(() => {
    const teams: Team[] = (game?.teams || []).slice();
    teams.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    return teams;
  }, [game]);

  if (!game) {
    return (
      <div className={styles.page}>
        <div style={{ padding: 24 }}>
          ما فيه لعبة شغالة. ارجع للفئات وابدأ لعبة جديدة.
          <div style={{ marginTop: 12 }}>
            <Link href="/categories">الذهاب لصفحة الفئات</Link>
          </div>
        </div>
      </div>
    );
  }

  const currentTeam: Team | undefined = game?.teams?.[game?.turnIndex ?? 0];

  return (
    <div className={styles.page} style={{ overflow: "hidden" }}>
      {/* ✅ نهاية اللعبة */}
      {showEnd ? (
        <div className={styles.endOverlay}>
          <div className={styles.endCard}>
            <div className={styles.endHeader}>
              <div>
                <div className={styles.endTitle}>انتهت اللعبة 🎉</div>
                <div className={styles.endSub}>الترتيب حسب أعلى النقاط</div>
              </div>
              <button className={styles.endBtnGhost} onClick={() => setShowEnd(false)} type="button">
                إغلاق
              </button>
            </div>

            <div className={styles.podiumWrap}>
              <div className={styles.podium}>
                {/* 2nd */}
                <div className={styles.podiumCol}>
                  <div className={styles.podiumTop}>
                    <span className={`${styles.badge} ${styles.badge2}`}>2</span>
                    <span>الثاني</span>
                  </div>
                  <div className={styles.podiumName} title={podium[1]?.name || "—"}>
                    {podium[1]?.icon ? <span style={{ marginInlineEnd: 8 }}>{renderTeamIcon(podium[1].icon, 18)}</span> : null}
                    {podium[1]?.name || "—"}
                  </div>
                  <div className={styles.podiumScore}>{podium[1]?.score ?? 0}</div>
                  <div className={`${styles.podiumBase} ${styles.base2}`}>🥈</div>
                </div>

                {/* 1st */}
                <div className={styles.podiumCol}>
                  <div className={styles.podiumTop}>
                    <span className={`${styles.badge} ${styles.badge1}`}>1</span>
                    <span>الأول</span>
                  </div>
                  <div className={styles.podiumName} title={podium[0]?.name || "—"}>
                    {podium[0]?.icon ? <span style={{ marginInlineEnd: 8 }}>{renderTeamIcon(podium[0].icon, 18)}</span> : null}
                    {podium[0]?.name || "—"}
                  </div>
                  <div className={styles.podiumScore}>{podium[0]?.score ?? 0}</div>
                  <div className={`${styles.podiumBase} ${styles.base1}`}>🏆</div>
                </div>

                {/* 3rd */}
                <div className={styles.podiumCol}>
                  <div className={styles.podiumTop}>
                    <span className={`${styles.badge} ${styles.badge3}`}>3</span>
                    <span>الثالث</span>
                  </div>
                  <div className={styles.podiumName} title={podium[2]?.name || "—"}>
                    {podium[2]?.icon ? <span style={{ marginInlineEnd: 8 }}>{renderTeamIcon(podium[2].icon, 18)}</span> : null}
                    {podium[2]?.name || "—"}
                  </div>
                  <div className={styles.podiumScore}>{podium[2]?.score ?? 0}</div>
                  <div className={`${styles.podiumBase} ${styles.base3}`}>🥉</div>
                </div>
              </div>

              {podium.length > 3 ? (
                <div style={{ background: "white", borderRadius: 18, border: "2px solid rgba(13,59,102,.10)", padding: 14 }}>
                  <div style={{ fontWeight: 900, color: "var(--navy)", marginBottom: 10 }}>باقي الترتيب</div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {podium.slice(3).map((t, idx) => (
                      <div
                        key={`${t.name}-${idx}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "10px 12px",
                          borderRadius: 14,
                          border: "2px solid rgba(13,59,102,.10)",
                          background: "rgba(13,59,102,.04)",
                          fontWeight: 900,
                          color: "var(--navy)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 12,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border: "2px solid rgba(13,59,102,.14)",
                              background: "white",
                              flex: "0 0 auto",
                            }}
                          >
                            {idx + 4}
                          </div>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.icon ? <span style={{ marginInlineEnd: 8 }}>{renderTeamIcon(t.icon, 18)}</span> : null}
                            {t.name}
                          </div>
                        </div>
                        <div
                          style={{
                            background: "rgba(250,240,202,.75)",
                            border: "2px solid rgba(13,59,102,.12)",
                            borderRadius: 999,
                            padding: "6px 10px",
                            minWidth: 64,
                            textAlign: "center",
                          }}
                        >
                          {t.score ?? 0}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className={styles.endActions}>
              <button className={styles.endBtn} onClick={restartGame} type="button">
                لعبة جديدة
              </button>
              <button className={styles.endBtnGhost} onClick={finishAndGoHome} type="button">
                إنهاء والعودة للرئيسية
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <header className={styles.topBar}>
        <div className={styles.leftBtns}>
          <Link className={styles.smallBtn} href="/categories">
            الرجوع للفئات
          </Link>

          <button
            className={styles.smallBtn}
            onClick={() => {
              localStorage.removeItem(LS_KEY);
              router.push("/");
            }}
            type="button"
          >
            إنهاء اللعبة
          </button>
        </div>

        {/* ✅ (2) تغيير العنوان */}
        <div className={styles.centerTitle}>لعبة مستوى</div>

        <div className={styles.turnPill}>
          {/* ✅ (3) زر تبديل الفريق داخل دور الفريق */}
          <button
            type="button"
            onClick={switchTeam}
            title="تبديل الفريق"
            aria-label="تبديل الفريق"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: 999,
              background: "rgba(250,240,202,.12)",
              border: "1px solid rgba(250,240,202,.25)",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            <Icon icon="mdi:rotate-right" width="18" height="18" />
          </button>

          <span>دور فريق:</span>
          <b style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {currentTeam?.icon ? renderTeamIcon(currentTeam.icon, 18) : null}
            <span>{currentTeam?.name ?? "—"}</span>
          </b>
        </div>
      </header>

      <main className={styles.boardWrap}>
        <div
          className={styles.board}
          style={{
            gridTemplateColumns: `repeat(${catIds.length}, minmax(0, 1fr))`,
          }}
        >
          {/* ✅ الهيدر يرجع طبيعي (اسم + صورة). لو ميتا فئة معيّنة ناقصة، نعرض Skeleton لها فقط */}
          {catIds.map((catId) => {
            const meta = catsMeta[catId];
            const title = (meta?.name || "").trim();
            const img = (meta?.imageUrl || "").trim();

            const loadingHeader = !title; // ما نعرض catId أبداً

            return (
              <div key={catId} className={styles.catHeader} style={{ backgroundImage: "none" as any }}>
                {loadingHeader ? (
                  <>
                    <div style={{ height: 18, borderRadius: 10, background: "rgba(13,59,102,.10)", marginBottom: 10 }} />
                    <div
                      style={{
                        height: 92,
                        borderRadius: 14,
                        background: "rgba(13,59,102,.08)",
                        border: "1px solid rgba(13,59,102,.10)",
                      }}
                    />
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight: 900, color: "var(--navy)", marginBottom: 8, textAlign: "center" }}>
                      {title}
                    </div>

                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={title}
                        style={{
                          width: "100%",
                          height: 92,
                          objectFit: "cover",
                          borderRadius: 14,
                          border: "1px solid rgba(255,255,255,.20)",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: 92,
                          borderRadius: 14,
                          background: "rgba(255,255,255,.10)",
                          border: "1px solid rgba(255,255,255,.14)",
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}

          {/* ✅ 6 صفوف */}
          {POINTS_ROWS.map((pts, rowIndex) =>
            catIds.map((catId) => {
              const idx = rowIndex % 2;

              const used = isUsed(catId, pts, idx);
              const enabled = canOpen(catId, pts, idx) && !used;

              return (
                <button
                  key={`${catId}-${pts}-${idx}-${rowIndex}`}
                  className={`${styles.cell} ${used ? styles.used : ""}`}
                  onClick={() => enabled && openQuestion(catId, pts, idx)}
                  type="button"
                  disabled={!enabled}
                  title={!canOpen(catId, pts, idx) ? "ما فيه سؤال بهذه النقاط" : ""}
                >
                  {pts}
                </button>
              );
            })
          )}
        </div>

        <section className={styles.teamsBar}>
          {game?.teams?.map((t: Team, i: number) => (
            <div key={i} className={styles.teamCard}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
                {t.icon ? renderTeamIcon(t.icon, 18) : null}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button className={styles.scoreBtn} onClick={() => changeScore(i, -50)} type="button" title="نقص 50">
                  −
                </button>

                <div className={styles.teamScore}>{t.score}</div>

                <button className={styles.scoreBtn} onClick={() => changeScore(i, +50)} type="button" title="زود 50">
                  +
                </button>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}