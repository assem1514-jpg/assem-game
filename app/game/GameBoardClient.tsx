"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./page.module.css";

import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, documentId } from "firebase/firestore";

type Team = { name: string; score: number };
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
  // (مفتاح الخلية صار فيه idx عشان يكون عندنا خلية أولى وثانية لنفس النقاط)
  const [hasQuestion, setHasQuestion] = useState<Record<string, boolean>>({});
  const [qidByCell, setQidByCell] = useState<Record<string, string>>({});

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
            name: data.name ?? data.title ?? data.catName ?? d.id,
            imageUrl: data.imageUrl ?? data.image ?? data.photoUrl ?? "",
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

        const missing = catIds.filter((id) => !map[id]);
        if (missing.length) {
          const q2 = query(
            collection(db, "categories"),
            where(documentId(), "in", missing.slice(0, 10))
          );
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
      if (!catIds.length) {
        setHasQuestion({});
        setQidByCell({});
        return;
      }

      try {
        const hasMap: Record<string, boolean> = {};
        const idMap: Record<string, string> = {};

        for (const catId of catIds) {
          const snap = await getDocs(
            collection(db, "packs", "main", "categories", catId, "questions")
          );

          // نجمع المرشحين لكل نقاط
          const bucket: Record<number, string[]> = { 200: [], 400: [], 600: [] };

          snap.forEach((d) => {
            const data = d.data() as any;
            const pts = Number(data.points || 0);
            if (![200, 400, 600].includes(pts)) return;
            bucket[pts].push(d.id);
          });

          // ✅ نخلي الاختيار ثابت: ترتيب id تصاعدي
          for (const pts of [200, 400, 600] as const) {
            const ids = (bucket[pts] || []).slice().sort();

            // الخلية الأولى
            if (ids[0]) {
              const key0 = `${catId}:${pts}:0`;
              hasMap[key0] = true;
              idMap[key0] = ids[0];
            }
            // الخلية الثانية
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
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setHasQuestion({});
          setQidByCell({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catIds.join("|")]);

  // ✅ idx = 0 أو 1 (أي خلية من الثنتين)
  function isUsed(catId: string, pts: number, idx: number) {
    return !!game?.used?.[`${catId}:${pts}:${idx}`];
  }

  function canOpen(catId: string, pts: number, idx: number) {
    return !!hasQuestion[`${catId}:${pts}:${idx}`];
  }

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

  return (
    <div className={styles.page}>
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

        <div className={styles.centerTitle}>لعبة جديدة</div>

        <div className={styles.turnPill}>
          <span>دور فريق:</span>
          <b>{game?.teams?.[game?.turnIndex ?? 0]?.name ?? "—"}</b>
        </div>
      </header>

      <main className={styles.boardWrap}>
        <div
          className={styles.board}
          style={{
            gridTemplateColumns: `repeat(${catIds.length}, minmax(0, 1fr))`,
          }}
        >
          {catIds.map((catId) => {
            const meta = catsMeta[catId];
            const title = meta?.name || catId;

            return (
              <div key={catId} className={styles.catHeader} style={{ backgroundImage: "none" as any }}>
                <div className={styles.catName} style={{ marginBottom: 8 }}>
                  {title}
                </div>

                {meta?.imageUrl?.trim() ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={meta.imageUrl.trim()}
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
              </div>
            );
          })}

          {/* ✅ 6 صفوف */}
          {POINTS_ROWS.map((pts, rowIndex) =>
            catIds.map((catId) => {
              // كل نقطتين لها idx: 0 ثم 1
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
              <div className={styles.teamName}>{t.name}</div>

              <div className={styles.teamScoreRow}>
                <button
                  className={styles.scoreBtn}
                  onClick={() => changeScore(i, -50)}
                  type="button"
                  title="نقص 50"
                >
                  −
                </button>

                <div className={styles.teamScore}>{t.score}</div>

                <button
                  className={styles.scoreBtn}
                  onClick={() => changeScore(i, +50)}
                  type="button"
                  title="زود 50"
                >
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