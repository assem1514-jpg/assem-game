// app/game/question/QuestionClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./page.module.css";

import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { Icon } from "@iconify/react";

type Team = { name: string; score: number; icon?: string };

const LS_KEY = "assem_game_v1";
const DEFAULT_SECONDS = 60;

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

  // ✅ اول حرف (من الأدمن)
  answerFirstLetter?: string;
};

type Lifelines = {
  twoAnswers: boolean;
  firstLetter: boolean;
  callFriend: boolean;
};

function getLifelines(game: any, teamIndex: number): Lifelines {
  const base: Lifelines = { twoAnswers: false, firstLetter: false, callFriend: false };
  const map = game?.lifelines || {};
  return { ...base, ...(map?.[teamIndex] || {}) };
}

function setLifelines(game: any, teamIndex: number, patch: Partial<Lifelines>) {
  game.lifelines = game.lifelines || {};
  const cur = getLifelines(game, teamIndex);
  game.lifelines[teamIndex] = { ...cur, ...patch };
}

function renderTeamIcon(icon?: string, size = 18) {
  if (!icon) return null;
  if (typeof icon === "string" && icon.includes(":")) {
    return <Icon icon={icon} width={size} height={size} />;
  }
  return <span>{icon}</span>;
}

function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, Number(totalSeconds || 0));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function QuestionPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const catId = sp.get("cat") || "";
  const pts = Number(sp.get("pts") || 0);
  const idx = Number(sp.get("idx") || 0);
  const qid = sp.get("qid") || "";
  const catsParam = normalizeCatsParam(sp.get("cats") || "");

  const [game, setGame] = useState(() => loadGame());
  const [showAnswer, setShowAnswer] = useState(false);

  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<QuestionDoc | null>(null);

  // ✅ اسم الفئة الحقيقي بدل الرمز
  const [catName, setCatName] = useState<string>("");

  // ✅ مؤقت
  const [secondsLeft, setSecondsLeft] = useState<number>(DEFAULT_SECONDS);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // ✅ إظهار أول حرف (حسب الفريق)
  const [revealedLetterForTeam, setRevealedLetterForTeam] = useState<Record<number, string>>({});

  // ✅ تفعيل المساعدة "لهذا السؤال فقط" (بدون ما تنتقل للسؤال اللي بعده)
  const [activeLifelines, setActiveLifelines] = useState<{ twoAnswers: boolean; firstLetter: boolean; callFriend: boolean }>(
    { twoAnswers: false, firstLetter: false, callFriend: false }
  );

  const currentTeamIndex = Number(game?.turnIndex ?? 0);
  const currentTeam: Team | undefined = game?.teams?.[currentTeamIndex];

  // ✅ جلب اسم الفئة
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!catId) {
        setCatName("");
        return;
      }

      try {
        const ref = doc(db, "packs", "main", "categories", catId);
        const snap = await getDoc(ref);
        if (!cancelled) {
          if (snap.exists()) {
            const data = snap.data() as any;
            const name = (data?.name ?? data?.title ?? data?.catName ?? "").toString().trim();
            setCatName(name);
          } else {
            setCatName("");
          }
        }
      } catch {
        if (!cancelled) setCatName("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catId]);

  // ✅ جلب السؤال
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!catId || !pts) {
        setQuestion(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setShowAnswer(false);
      setRevealedLetterForTeam({});
      setSecondsLeft(DEFAULT_SECONDS);
      setTimerRunning(false);

      // ✅ مهم: أي "تفعيل" للمساعدة يكون لسؤال واحد فقط
      setActiveLifelines({ twoAnswers: false, firstLetter: false, callFriend: false });

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
              answerFirstLetter:
                (data.answerFirstLetter ?? data.firstLetter ?? data.answerLetter ?? data.firstChar ?? "")?.toString() ?? "",
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
              answerFirstLetter:
                (data.answerFirstLetter ?? data.firstLetter ?? data.answerLetter ?? data.firstChar ?? "")?.toString() ?? "",
            };
          });
        }

        if (!cancelled) {
          setQuestion(found);
          setLoading(false);
          if (found) setTimerRunning(true);
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

  // ✅ تشغيل المؤقت
  useEffect(() => {
    if (!timerRunning) return;
    if (showAnswer) return;
    if (!question) return;

    const t = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);

    return () => clearInterval(t);
  }, [timerRunning, showAnswer, question]);

  // ✅ إذا انتهى الوقت: يوقف المؤقت فقط (بدون إظهار الجواب تلقائيًا)
  useEffect(() => {
    if (!question) return;
    if (showAnswer) return;

    if (secondsLeft === 0) {
      setTimerRunning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, question, showAnswer]);

  const catTitle = useMemo(() => ((catName || "").trim() ? catName : "…"), [catName]);

  function backToBoard() {
    router.push(`/game?cats=${encodeURIComponent(catsParam)}`);
  }

  function markUsed(updatedGame: any, advanceTurn: boolean) {
    updatedGame.used = updatedGame.used || {};
    updatedGame.used[`${catId}:${pts}:${idx}`] = true;

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
    updated.teams = (updated.teams || []).map((t: Team, i: number) => (i === teamIndex ? { ...t, score: (t.score || 0) + pts } : t));
    markUsedAndBack(updated);
  }

  function nobodyAnswered() {
    if (!game) return;
    const updated = { ...game };
    markUsedAndBack(updated);
  }

  function showAnswerNow() {
    if (!game) return;
    setShowAnswer(true);
    setTimerRunning(false);

    const updated = { ...game };
    markUsed(updated, false);
  }

  function backToQuestionView() {
    setShowAnswer(false);
    if (question && secondsLeft > 0) setTimerRunning(true);
  }

  function useTwoAnswers() {
    if (!game) return;
    const updated = { ...game };
    setLifelines(updated, currentTeamIndex, { twoAnswers: true });
    saveGame(updated);
    setGame(updated);

    // ✅ يتفعّل لهذا السؤال فقط
    setActiveLifelines((p) => ({ ...p, twoAnswers: true }));
  }

  function useFirstLetter() {
    if (!game || !question) return;

    const letter = (question.answerFirstLetter || "").trim();
    const updated = { ...game };
    setLifelines(updated, currentTeamIndex, { firstLetter: true });
    saveGame(updated);
    setGame(updated);

    // ✅ يتفعّل لهذا السؤال فقط
    setActiveLifelines((p) => ({ ...p, firstLetter: true }));

    setRevealedLetterForTeam((p) => ({
      ...p,
      [currentTeamIndex]: letter || "—",
    }));
  }

  function useCallFriend() {
    if (!game) return;
    const updated = { ...game };
    setLifelines(updated, currentTeamIndex, { callFriend: true });
    saveGame(updated);
    setGame(updated);

    // ✅ يتفعّل لهذا السؤال فقط
    setActiveLifelines((p) => ({ ...p, callFriend: true }));
  }

  // ✅ أزرار المؤقت (شكل الصورة: pause + reset)
  function toggleTimer() {
    if (!question) return;
    if (showAnswer) return;
    if (secondsLeft === 0) return;
    setTimerRunning((v) => !v);
  }
  function resetTimer() {
    if (!question) return;
    if (showAnswer) return;
    setSecondsLeft(DEFAULT_SECONDS);
    setTimerRunning(true);
  }

  if (!game) {
    return (
      <div className={styles.page} style={{ padding: 24 }}>
        ما فيه لعبة شغالة. ارجع للفئات وابدأ لعبة جديدة.
      </div>
    );
  }

  const lifelines = getLifelines(game, currentTeamIndex);

  return (
    <div className={styles.page}>
      {/* الهيدر (لا تغيّر أزراره) */}
      <header className={styles.topBar}>
        <div className={styles.left}>
          {!showAnswer ? (
            <button className={styles.btn} onClick={backToBoard} type="button">
              الرجوع للوحة
            </button>
          ) : (
            <button className={styles.btn} onClick={backToQuestionView} type="button">
              الرجوع للسؤال
            </button>
          )}
        </div>

        <div className={styles.center}>{showAnswer ? "الجواب" : "سؤال"}</div>

        <div className={styles.rightPill}>
          <span>{catTitle}</span>
          <b>{pts} نقطة</b>
        </div>
      </header>

      <main className={styles.layout}>
        {/* ====== مربع السؤال (نفس روح صورة المثال) ====== */}
        <section className={styles.card} style={{ padding: 18 }}>
          {loading ? (
            <div className={styles.qTitle}>جاري التحميل…</div>
          ) : !question ? (
            <div className={styles.qTitle}>ما فيه سؤال بهذه النقاط داخل هذه الفئة.</div>
          ) : (
            <div
              style={{
                border: "4px solid rgba(13,59,102,.45)",
                borderRadius: 18,
                padding: 16,
                position: "relative",
                background: "white",
              }}
            >
              {/* شريط علوي داخل الإطار: (الفئة يسار) (المؤقت بالنص) (النقاط يمين) */}
              {!showAnswer ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  {/* يسار: اسم الفئة */}
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div
                      style={{
                        background: "rgba(0,0,0,.85)",
                        color: "white",
                        padding: "10px 14px",
                        borderRadius: 14,
                        fontWeight: 900,
                        minWidth: 120,
                        textAlign: "center",
                      }}
                      title={catTitle}
                    >
                      {catTitle}
                    </div>
                  </div>

                  {/* وسط: المؤقت + إيقاف/تشغيل + إعادة */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 12,
                      background: "rgba(0,0,0,.85)",
                      color: "white",
                      padding: "10px 16px",
                      borderRadius: 16,
                      fontWeight: 900,
                    }}
                  >
                    <button
                      type="button"
                      onClick={toggleTimer}
                      disabled={!question || showAnswer || secondsLeft === 0}
                      title={timerRunning ? "إيقاف" : "تشغيل"}
                      style={{
                        all: "unset",
                        cursor: timerRunning ? "pointer" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 28,
                        height: 28,
                        borderRadius: 10,
                      }}
                    >
                      <Icon icon={timerRunning ? "mdi:pause" : "mdi:play"} width="22" height="22" />
                    </button>

                    <div style={{ fontSize: 18, letterSpacing: 0.5 }}>{formatMMSS(secondsLeft)}</div>

                    <button
                      type="button"
                      onClick={resetTimer}
                      disabled={!question || showAnswer}
                      title="إعادة"
                      style={{
                        all: "unset",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 28,
                        height: 28,
                        borderRadius: 10,
                      }}
                    >
                      <Icon icon="mdi:restart" width="22" height="22" />
                    </button>
                  </div>

                  {/* يمين: النقاط */}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div
                      style={{
                        background: "rgba(0,0,0,.85)",
                        color: "white",
                        padding: "10px 14px",
                        borderRadius: 14,
                        fontWeight: 900,
                        minWidth: 120,
                        textAlign: "center",
                      }}
                    >
                      {pts} نقطة
                    </div>
                  </div>
                </div>
              ) : null}

              {/* عنوان السؤال/الجواب */}
              {!showAnswer ? (
                <div className={styles.qTitle} style={{ marginBottom: 14 }}>
                  {question.text}
                </div>
              ) : (
                <div className={styles.qTitle} style={{ marginBottom: 14, fontSize: 22 }}>
                  {question.answerText || "—"}
                </div>
              )}

              {/* الصورة */}
              {!showAnswer ? (
                question.imageUrl ? (
                  <div className={styles.media} style={{ minHeight: 280 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={question.imageUrl} alt="question" />
                  </div>
                ) : null
              ) : question.answerImageUrl ? (
                <div className={styles.media} style={{ minHeight: 280 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={question.answerImageUrl} alt="answer" />
                </div>
              ) : null}

              {/* ✅ أول حرف يظهر فقط إذا تفعّل في "هذا السؤال" */}
              {!showAnswer && activeLifelines.firstLetter ? (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "2px solid rgba(13,59,102,.10)",
                    background: "rgba(13,59,102,.04)",
                    fontWeight: 900,
                    color: "var(--navy)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Icon icon="mdi:alphabetical-variant" width="20" height="20" />
                    أول حرف:
                  </span>
                  <span style={{ fontSize: 20 }}>
                    {revealedLetterForTeam[currentTeamIndex] ?? (question.answerFirstLetter?.trim() || "—")}
                  </span>
                </div>
              ) : null}

              {/* زر الإجابة (نفس مكان/فكرة الصورة) + زر الرجوع */}
              {!showAnswer ? (
                <>
                  <button
                    className={styles.answerBtn}
                    onClick={showAnswerNow}
                    type="button"
                    style={{
                      position: "absolute",
                      left: 16,
                      bottom: 16,
                      borderRadius: 16,
                      padding: "14px 18px",
                      minWidth: 120,
                    }}
                  >
                    الإجابة
                  </button>

                  <button
                    className={styles.backBtn}
                    onClick={backToBoard}
                    type="button"
                    style={{
                      position: "absolute",
                      left: 16 + 140,
                      bottom: 16,
                      borderRadius: 16,
                      padding: "14px 18px",
                    }}
                  >
                    الرجوع للوحة
                  </button>
                </>
              ) : (
                <div className={styles.bottomRow} style={{ marginTop: 14 }}>
                  <button className={styles.backBtn} onClick={backToQuestionView} type="button">
                    الرجوع للسؤال
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ====== الجانب (لا تغيّر وسائل المساعدة) ====== */}
        <aside className={styles.side}>
          <div className={styles.sideTitle}>
            دور الآن:{" "}
            <span style={{ fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 8 }}>
              {currentTeam?.icon ? renderTeamIcon(currentTeam.icon, 18) : null}
              <span>{currentTeam?.name ?? "—"}</span>
            </span>
          </div>

          {/* ✅ وسائل المساعدة للفريق الحالي (لا تغيّرها) */}
          <div
            style={{
              display: "grid",
              gap: 10,
              marginTop: 10,
              padding: 12,
              borderRadius: 16,
              border: "2px solid rgba(13,59,102,.10)",
              background: "rgba(13,59,102,.04)",
            }}
          >
            <button
              type="button"
              onClick={useTwoAnswers}
              disabled={!question || showAnswer || lifelines.twoAnswers}
              title={lifelines.twoAnswers ? "تم استخدامها" : ""}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "12px 12px",
                borderRadius: 14,
                border: "2px solid rgba(13,59,102,.12)",
                background: "white",
                fontWeight: 900,
                color: "var(--navy)",
                cursor: lifelines.twoAnswers ? "not-allowed" : "pointer",
                opacity: lifelines.twoAnswers ? 0.5 : 1,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <Icon icon="mdi:numeric-2-circle" width="22" height="22" />
                فعل اجابتين
              </span>
              <span>{lifelines.twoAnswers ? "مستخدمة" : "استخدم"}</span>
            </button>

            <button
              type="button"
              onClick={useFirstLetter}
              disabled={!question || showAnswer || lifelines.firstLetter}
              title={lifelines.firstLetter ? "تم استخدامها" : ""}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "12px 12px",
                borderRadius: 14,
                border: "2px solid rgba(13,59,102,.12)",
                background: "white",
                fontWeight: 900,
                color: "var(--navy)",
                cursor: lifelines.firstLetter ? "not-allowed" : "pointer",
                opacity: lifelines.firstLetter ? 0.5 : 1,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <Icon icon="mdi:alphabetical-variant" width="22" height="22" />
                عطني أول حرف
              </span>
              <span>{lifelines.firstLetter ? "مستخدمة" : "استخدم"}</span>
            </button>

            <button
              type="button"
              onClick={useCallFriend}
              disabled={!question || showAnswer || lifelines.callFriend}
              title={lifelines.callFriend ? "تم استخدامها" : ""}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "12px 12px",
                borderRadius: 14,
                border: "2px solid rgba(13,59,102,.12)",
                background: "white",
                fontWeight: 900,
                color: "var(--navy)",
                cursor: lifelines.callFriend ? "not-allowed" : "pointer",
                opacity: lifelines.callFriend ? 0.5 : 1,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <Icon icon="mdi:phone" width="22" height="22" />
                اتصال بصديق
              </span>
              <span>{lifelines.callFriend ? "مستخدمة" : "استخدم"}</span>
            </button>
          </div>

          <div className={styles.sideTitle} style={{ marginTop: 14 }}>
            الفريق اللي جاوب صح
          </div>

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
                {t.icon ? <span style={{ marginInlineEnd: 8 }}>{renderTeamIcon(t.icon, 18)}</span> : null}
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

          {/* شعارك داخل المشروع: public/logo.png */}
          <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="logo"
              style={{
                width: 92,
                height: 92,
                objectFit: "contain",
                borderRadius: 18,
                background: "white",
                border: "2px solid rgba(13,59,102,.12)",
              }}
            />
          </div>
        </aside>
      </main>
    </div>
  );
}