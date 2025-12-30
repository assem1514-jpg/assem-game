"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./page.module.css";

import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

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
  const catsParam = normalizeCatsParam(sp.get("cats") || "");

  const [game, setGame] = useState(() => loadGame());
  const [showAnswer, setShowAnswer] = useState(false);

  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<QuestionDoc | null>(null);

  // ✅ جلب السؤال الحقيقي من Firestore: packs/main/categories/{catId}/questions
  // ✅ نطابق النقاط باستخدام Number() عشان لو النقاط محفوظة كنص "100" ما تخرب
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
        const snap = await getDocs(
          collection(db, "packs", "main", "categories", catId, "questions")
        );

        let found: QuestionDoc | null = null;

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
  }, [catId, pts]);

  function backToBoard() {
    router.push(`/game?cats=${encodeURIComponent(catsParam)}`);
  }

  function markUsedAndBack(updatedGame: any) {
    updatedGame.used = updatedGame.used || {};
    updatedGame.used[`${catId}:${pts}`] = true;

    const n = updatedGame.teams?.length || 0;
    if (n > 0) updatedGame.turnIndex = ((updatedGame.turnIndex ?? 0) + 1) % n;

    saveGame(updatedGame);
    setGame(updatedGame);
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
          <button className={styles.btn} onClick={backToBoard} type="button">
            الرجوع للوحة
          </button>
        </div>

        <div className={styles.center}>سؤال</div>

        <div className={styles.rightPill}>
          {/* كان يعرض catId (كود) — خليه اسم مؤقت: */}
          <span>{catId || "فئة"}</span>
          <b>{pts} نقطة</b>
        </div>
      </header>

      <main className={styles.layout}>
        <section className={styles.card}>
          {loading ? (
            <div className={styles.qTitle}>جاري تحميل السؤال…</div>
          ) : !question ? (
            <div className={styles.qTitle}>
              ما فيه سؤال بهذه النقاط داخل هذه الفئة. (تأكد أن النقاط مطابقة)
            </div>
          ) : (
            <>
              <div className={styles.qTitle}>{question.text}</div>

              {question.imageUrl ? (
                <div className={styles.media}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={question.imageUrl} alt="question" />
                </div>
              ) : null}

              <div className={styles.bottomRow}>
                {!showAnswer ? (
                  <button
                    className={styles.answerBtn}
                    onClick={() => setShowAnswer(true)}
                    type="button"
                  >
                    أظهر الجواب
                  </button>
                ) : (
                  <div className={styles.answerBox}>
                    <div className={styles.answerLabel}>الإجابة:</div>
                    <div className={styles.answerText}>
                      {question.answerText || "—"}
                    </div>

                    {question.answerImageUrl ? (
                      <div style={{ marginTop: 10 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={question.answerImageUrl}
                          alt="answer"
                          style={{ width: "100%", borderRadius: 12 }}
                        />
                      </div>
                    ) : null}
                  </div>
                )}

                <button
                  className={styles.backBtn}
                  onClick={backToBoard}
                  type="button"
                >
                  الرجوع للوحة
                </button>
              </div>
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
            disabled={!question}
          >
            محد جاوب
          </button>
        </aside>
      </main>
    </div>
  );
}