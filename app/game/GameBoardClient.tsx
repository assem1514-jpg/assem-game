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
  const catIds = useMemo(
    () => rawCats.split(",").map((x) => x.trim()).filter(Boolean),
    [rawCats]
  );

  const [game, setGame] = useState(() => loadGame());
  const [catsMeta, setCatsMeta] = useState<Record<string, CatMeta>>({});
  const [pointsRows, setPointsRows] = useState<number[]>([600, 500, 400, 300, 200, 100]);

  // ✅ جلب ميتا الفئات (الاسم + الصورة) من نفس مكان الأدمن (مع fallback)
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
        // 1) جرّب مسار الأدمن غالبًا: packs/main/categories
        const q1 = query(
          collection(db, "packs", "main", "categories"),
          where(documentId(), "in", catIds.slice(0, 10))
        );
        const snap1 = await getDocs(q1);
        let map = buildMap(snap1);

        // 2) لو في فئات ناقصة جرّب المسار الثاني: /categories
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

  // ✅ بناء صفوف النقاط من الأسئلة الحقيقية (6 صفوف) من: packs/main/categories/{catId}/questions
  const [hasQuestion, setHasQuestion] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!catIds.length) {
        setHasQuestion({});
        setPointsRows([600, 500, 400, 300, 200, 100]);
        return;
      }

      try {
        const map: Record<string, boolean> = {};
        const pointsSet = new Set<number>();

        for (const catId of catIds) {
          const snap = await getDocs(
            collection(db, "packs", "main", "categories", catId, "questions")
          );

          snap.forEach((d) => {
            const data = d.data() as any;
            const pts = Number(data.points || 0);
            if (pts > 0) {
              pointsSet.add(pts);
              map[`${catId}:${pts}`] = true;
            }
          });
        }

        const sorted = Array.from(pointsSet).sort((a, b) => b - a);

        const fallback = [600, 500, 400, 300, 200, 100];
        for (const f of fallback) if (!sorted.includes(f)) sorted.push(f);

        const finalRows = sorted.slice(0, 6);

        if (!cancelled) {
          setHasQuestion(map);
          setPointsRows(finalRows);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setHasQuestion({});
          setPointsRows([600, 500, 400, 300, 200, 100]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catIds.join("|")]);

  function isUsed(catId: string, pts: number) {
    return !!game?.used?.[`${catId}:${pts}`];
  }

  function canOpen(catId: string, pts: number) {
    return !!hasQuestion[`${catId}:${pts}`];
  }

  function openQuestion(catId: string, pts: number) {
    if (!game) return;
    router.push(
      `/game/question?cat=${encodeURIComponent(catId)}&pts=${pts}&cats=${encodeURIComponent(
        catIds.join(",")
      )}`
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
              <div
                key={catId}
                className={styles.catHeader}
                style={
                  meta?.imageUrl
                    ? {
                        backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,.55)), url(${meta.imageUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              >
                <div className={styles.catName}>{title}</div>
              </div>
            );
          })}

          {pointsRows.map((pts) =>
            catIds.map((catId) => {
              const used = isUsed(catId, pts);
              const enabled = canOpen(catId, pts) && !used;

              return (
                <button
                  key={`${catId}-${pts}`}
                  className={`${styles.cell} ${used ? styles.used : ""}`}
                  onClick={() => enabled && openQuestion(catId, pts)}
                  type="button"
                  disabled={!enabled}
                  title={!canOpen(catId, pts) ? "ما فيه سؤال بهذه النقاط" : ""}
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