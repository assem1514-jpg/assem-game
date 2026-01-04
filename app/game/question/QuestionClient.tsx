"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./page.module.css";

import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

type Team = { name: string; score: number };

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

type QuestionDoc = {
  text: string;
  points: number;
  imageUrl?: string;
  answerText?: string;
  answerImageUrl?: string;
};

export default function QuestionPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const catId = sp.get("cat") || "";
  const pts = Number(sp.get("pts") || 0);
  const idx = Number(sp.get("idx") || 0); // ✅ جديد
  const qid = sp.get("qid") || "";
  const catsParam = normalizeCatsParam(sp.get("cats") || "");

  const [game, setGame] = useState(() => loadGame());
  const [showAnswer, setShowAnswer] = useState(false);

  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<QuestionDoc | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!catId || !pts) {
        setQuestion(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let found: QuestionDoc | null = null;

        if (qid) {
          const ref = doc(db, "packs", "main", "categories", catId, "questions", qid);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const data = snap.data() as any;
            const p = Number(data.points ?? 0);

            found = {
              text: data.text ?? "",
              points: p || pts,
              imageUrl: data.imageUrl ?? "",
              answerText: data.answerText ?? "",
              answerImageUrl: data.answerImageUrl ?? "",
            };
          }
        }

        if (!found) {
          const snap = await getDocs(collection(db, "packs", "main", "categories", catId, "questions"));
          snap.forEach((d) => {
            if (found) return;
            const data = d.data() as any;
            const p = Number(data.points ?? 0);
            if (p !== pts) return;

            found = {
              text: data.text ?? "",
              points: p,
              imageUrl: data.imageUrl ?? "",
              answerText: data.answerText ?? "",
              answerImageUrl: data.answerImageUrl ?? "",
            };
          });
        }

        if (!cancelled) {
          setQuestion(found);
          setLoading(false);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setQuestion(null);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catId, pts, qid]);

  const catTitle = useMemo(() => catId || "فئة", [catId]);

  function backToBoard() {
    router.push(`/game?cats=${encodeURIComponent(catsParam)}`);
  }

  function markUsed(updatedGame: any, advanceTurn: boolean) {
    updatedGame.used = updatedGame.used || {};
    updatedGame.used[`${catId}:${pts}:${idx}`] = true; // ✅ مهم

    if (advanceTurn) {
      const n = updatedGame.teams?.length || 0;
      if (n > 0) updatedGame.turnIndex = ((updatedGame.turnIndex ?? 0) + 1) % n;
    }

    saveGame(updatedGame);
    setGame(updatedGame);
  }

  function markUsedAndBack(updatedGame: any) {
    markUsed(updatedGame, true);
    backToBoard();
  }

  function awardToTeam(teamIndex: number) {
    if (!game) return;
    const updated = { ...game };
    updated.teams = (updated.teams || []).map((t: Team, i: number) =>
      i === teamIndex ? { ...t, score: (t.score || 0) + pts } : t
    );
    markUsedAndBack(updated);
  }

  function nobodyAnswered() {
    if (!game) return;
    const updated = { ...game };
    markUsedAndBack(updated);
  }

  function backSmart() {
    if (!game) return backToBoard();
    if (showAnswer && question) {
      const updated = { ...game };
      markUsedAndBack(updated);
      return;
    }
    backToBoard();
  }

  if (!game) {
    return (
      <div className={styles.page} style={{ padding: 24 }}>
        ما فيه لعبة شغالة. ارجع للفئات وابدأ لعبة جديدة.
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.left}>
          <button className={styles.btn} onClick={backSmart} type="button">
            الرجوع للوحة
          </button>
        </div>

        <div className={styles.center}>{showAnswer ? "الجواب" : "سؤال"}</div>

        <div className={styles.rightPill}>
          <span>{catTitle}</span>
          <b>{pts} نقطة</b>
        </div>
      </header>

      <main className={styles.layout}>
        <section className={styles.card}>
          {loading ? (
            <div className={styles.qTitle}>جاري التحميل…</div>
          ) : !question ? (
            <div className={styles.qTitle}>ما فيه سؤال بهذه النقاط داخل هذه الفئة.</div>
          ) : (
            <>
              {!showAnswer ? (
                <>
                  <div className={styles.qTitle}>{question.text}</div>

                  {question.imageUrl ? (
                    <div className={styles.media}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={question.imageUrl} alt="question" />
                    </div>
                  ) : null}

                  <div className={styles.bottomRow}>
                    <button
                      className={styles.answerBtn}
                      onClick={() => {
                        setShowAnswer(true);
                        const updated = { ...game };
                        markUsed(updated, false); // تقفل الخلية مباشرة
                      }}
                      type="button"
                    >
                      أظهر الجواب
                    </button>

                    <button className={styles.backBtn} onClick={backSmart} type="button">
                      الرجوع للوحة
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* ✅ بعد الجواب: نص + صورة الجواب فقط (بدون صورة السؤال) */}
                  <div className={styles.qTitle} style={{ fontSize: 22 }}>
                    {question.answerText || "—"}
                  </div>

                  {question.answerImageUrl ? (
                    <div className={styles.media}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={question.answerImageUrl} alt="answer" />
                    </div>
                  ) : null}

                  <div className={styles.bottomRow}>
                    <button className={styles.backBtn} onClick={backSmart} type="button">
                      الرجوع للوحة
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </section>

        <aside className={styles.side}>
          <div className={styles.sideTitle}>الفريق اللي جاوب صح</div>

          <div className={styles.teamBtns}>
            {(game?.teams || []).map((t: Team, i: number) => (
              <button
                key={i}
                className={styles.teamBtn}
                onClick={() => awardToTeam(i)}
                type="button"
                disabled={!showAnswer || !question}
                title={!showAnswer ? "اظهر الجواب أولًا" : ""}
              >
                {t.name}
              </button>
            ))}
          </div>

          <button
            className={styles.nobodyBtn}
            onClick={nobodyAnswered}
            type="button"
            disabled={!question || !showAnswer}
            title={!showAnswer ? "اظهر الجواب أولًا" : ""}
          >
            محد جاوب
          </button>
        </aside>
      </main>
    </div>
  );
}