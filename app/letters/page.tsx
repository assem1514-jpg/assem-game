"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LettersBoard from "./LettersBoard";
import styles from "./page.module.css";
import { useRouter, useSearchParams } from "next/navigation";

import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type Phase = "idle" | "countdown" | "question";
type UsedQuestionIdsByLetter = Record<string, string[]>;

const STAGE_W = 1600;
const STAGE_H = 900;

function normalizeLetter(raw: string) {
  return (raw || "")
    .trim()
    .normalize("NFC")
    .replace(/\u0640/g, "")
    .replace("هـ", "ه");
}

function generate4CharCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function generateUniqueSessionCode() {
  for (let i = 0; i < 10; i++) {
    const code = generate4CharCode();

    const q = query(
      collection(db, "sessions"),
      where("code", "==", code),
      limit(1)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      return code;
    }
  }

  throw new Error("تعذر إنشاء كود فريد");
}

export default function Page() {
  const router = useRouter();
  const sp = useSearchParams();

  const [greenTeam, setGreenTeam] = useState("الفريق الأخضر");
  const [redTeam, setRedTeam] = useState("الفريق الأحمر");
  const [gameStarted, setGameStarted] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [pickedLetter, setPickedLetter] = useState<string>("");
  const [seconds, setSeconds] = useState<number>(0);
  const [questionText, setQuestionText] = useState<string>("هنا يظهر السؤال…");
  const [answerText, setAnswerText] = useState<string>("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [usedQuestionIdsByLetter, setUsedQuestionIdsByLetter] =
    useState<UsedQuestionIdsByLetter>({});

  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  const [webCodeModalOpen, setWebCodeModalOpen] = useState(false);
  const [generatedWebCode, setGeneratedWebCode] = useState("");
  const [generatedWebUrl, setGeneratedWebUrl] = useState("");
  const [modalText, setModalText] = useState<string | null>(null);
  const [sessionDocId, setSessionDocId] = useState<string>("");

  const activePackId = useMemo(() => "main", []);
  const intervalRef = useRef<number | null>(null);
  const sessionCode = (sp.get("session") || "").trim().toUpperCase();

  async function persistLettersState(patch: Partial<any>) {
    if (!sessionDocId) return;

    try {
      const gameData = {
        startedAt: Date.now(),
        packId: activePackId,
        mode: "letters",
        teams: [
          { name: greenTeam || "الفريق الأخضر", color: "green" },
          { name: redTeam || "الفريق الأحمر", color: "red" },
        ],
        phase,
        pickedLetter,
        seconds,
        questionText,
        answerText,
        showAnswer,
        usedQuestionIdsByLetter,
        ...patch,
      };

      await updateDoc(doc(db, "sessions", sessionDocId), {
        gameData,
      });
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function initFromSession() {
      if (!sessionCode) return;

      try {
        const q = query(
          collection(db, "sessions"),
          where("code", "==", sessionCode),
          where("isActive", "==", true),
          limit(1)
        );

        const snap = await getDocs(q);
        if (snap.empty) return;

        const foundDocId = snap.docs[0].id;
        const sessionData = snap.docs[0].data() as any;
        const expiresAt = Number(sessionData?.expiresAt ?? 0);

        if (!expiresAt || Date.now() > expiresAt) return;
        if (sessionData?.mode !== "letters") return;

        const gameData = sessionData?.gameData || {};
        const teams = Array.isArray(gameData?.teams) ? gameData.teams : [];

        if (!cancelled) {
          setSessionDocId(foundDocId);
          setGreenTeam((teams[0]?.name || "الفريق الأخضر").toString());
          setRedTeam((teams[1]?.name || "الفريق الأحمر").toString());
          setGameStarted(true);
          setPhase((gameData?.phase || "idle") as Phase);
          setPickedLetter((gameData?.pickedLetter || "").toString());
          setSeconds(Number(gameData?.seconds || 0));
          setQuestionText((gameData?.questionText || "هنا يظهر السؤال…").toString());
          setAnswerText((gameData?.answerText || "").toString());
          setShowAnswer(Boolean(gameData?.showAnswer));
          setUsedQuestionIdsByLetter(
            (gameData?.usedQuestionIdsByLetter || {}) as UsedQuestionIdsByLetter
          );
        }
      } catch (e) {
        console.error(e);
      }
    }

    initFromSession();

    return () => {
      cancelled = true;
    };
  }, [sessionCode]);

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        w: window.innerWidth,
        h: window.innerHeight,
      });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
    };
  }, []);

  const stageScale = useMemo(() => {
    if (!viewport.w || !viewport.h) return 1;
    const pad = 12;
    const availableW = Math.max(0, viewport.w - pad * 2);
    const availableH = Math.max(0, viewport.h - pad * 2);
    return Math.min(availableW / STAGE_W, availableH / STAGE_H);
  }, [viewport]);

  async function loadQuestionFromFirestore(
    letter: string,
    usedMap: UsedQuestionIdsByLetter
  ) {
    const key = normalizeLetter(letter);

    const questionsRef = collection(
      db,
      "packs",
      activePackId,
      "lettersGame",
      key,
      "questions"
    );

    const snap = await getDocs(questionsRef);

    if (snap.empty) {
      return {
        id: "",
        q: `مافي أسئلة محفوظة للحرف (${letter})`,
        a: "",
        resetUsed: false,
      };
    }

    const allDocs = snap.docs;
    const usedIds = new Set(usedMap[key] || []);
    let availableDocs = allDocs.filter((d) => !usedIds.has(d.id));
    let resetUsed = false;

    if (availableDocs.length === 0) {
      availableDocs = allDocs;
      resetUsed = true;
    }

    const randomIndex = Math.floor(Math.random() * availableDocs.length);
    const randomDoc = availableDocs[randomIndex];
    const data = randomDoc.data() as any;

    return {
      id: randomDoc.id,
      q: String(data?.question ?? `مافي سؤال محفوظ للحرف (${letter})`),
      a: String(data?.answer ?? ""),
      resetUsed,
    };
  }

  async function startLocalGame() {
    setGreenTeam("الفريق الأخضر");
    setRedTeam("الفريق الأحمر");
    setGameStarted(true);
    setPhase("idle");
    setPickedLetter("");
    setSeconds(0);
    setQuestionText("هنا يظهر السؤال…");
    setAnswerText("");
    setShowAnswer(false);
    setUsedQuestionIdsByLetter({});
  }

  async function startWebGame() {
    try {
      const sessionCodeValue = await generateUniqueSessionCode();
      const origin = typeof window !== "undefined" ? window.location.origin : "";

      await addDoc(collection(db, "sessions"), {
        code: sessionCodeValue,
        createdAt: serverTimestamp(),
        expiresAt: Date.now() + 4 * 60 * 60 * 1000,
        isActive: true,
        mode: "letters",
        packId: activePackId,
        screenId: "main-screen",
        status: "active",
        gameData: {
          startedAt: Date.now(),
          packId: activePackId,
          mode: "letters",
          teams: [
            { name: "الفريق الأخضر", color: "green" },
            { name: "الفريق الأحمر", color: "red" },
          ],
          phase: "idle",
          pickedLetter: "",
          seconds: 0,
          questionText: "هنا يظهر السؤال…",
          answerText: "",
          showAnswer: false,
          usedQuestionIdsByLetter: {},
        },
      });

      setGeneratedWebCode(sessionCodeValue);
      setGeneratedWebUrl(`${origin}/play`);
      setWebCodeModalOpen(true);
    } catch (error) {
      console.error(error);
      setModalText("صار خطأ أثناء إنشاء كود اللعبة");
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setModalText("تم النسخ");
    } catch {
      setModalText("ما قدرت أنسخ تلقائي، انسخه يدويًا");
    }
  }

  async function handleShowAnswer() {
    setShowAnswer(true);
    await persistLettersState({
      showAnswer: true,
    });
  }

  function startCountdown(letter: string) {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const key = normalizeLetter(letter);

    setPickedLetter(letter);
    setPhase("countdown");
    setAnswerText("");
    setQuestionText("استعد… سيظهر السؤال بعد:");
    setShowAnswer(false);

    const total = 3;
    setSeconds(total);

    void persistLettersState({
      phase: "countdown",
      pickedLetter: letter,
      seconds: total,
      questionText: "استعد… سيظهر السؤال بعد:",
      answerText: "",
      showAnswer: false,
    });

    let t = total;
    intervalRef.current = window.setInterval(async () => {
      t -= 1;
      setSeconds(t);

      void persistLettersState({
        phase: "countdown",
        pickedLetter: letter,
        seconds: t,
        questionText: "استعد… سيظهر السؤال بعد:",
        answerText: "",
        showAnswer: false,
      });

      if (t <= 0) {
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        try {
          const item = await loadQuestionFromFirestore(letter, usedQuestionIdsByLetter);

          setQuestionText(item.q);
          setAnswerText(item.a);
          setShowAnswer(false);
          setPhase("question");

          let baseUsedMap = usedQuestionIdsByLetter;

          if (item.resetUsed) {
            baseUsedMap = {
              ...usedQuestionIdsByLetter,
              [key]: [],
            };
          }

          let nextUsedMap = baseUsedMap;

          if (item.id) {
            nextUsedMap = {
              ...baseUsedMap,
              [key]: [...(baseUsedMap[key] || []), item.id],
            };
          }

          setUsedQuestionIdsByLetter(nextUsedMap);

          await persistLettersState({
            phase: "question",
            pickedLetter: letter,
            seconds: 0,
            questionText: item.q,
            answerText: item.a,
            showAnswer: false,
            usedQuestionIdsByLetter: nextUsedMap,
          });
        } catch {
          const errText = `صار خطأ في جلب سؤال الحرف (${letter})`;
          setQuestionText(errText);
          setAnswerText("");
          setShowAnswer(false);
          setPhase("question");

          await persistLettersState({
            phase: "question",
            pickedLetter: letter,
            seconds: 0,
            questionText: errText,
            answerText: "",
            showAnswer: false,
            usedQuestionIdsByLetter,
          });
        }
      }
    }, 1000);
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.fitWrap}>
        <div
          className={styles.stageScale}
          style={{
            width: `${STAGE_W}px`,
            height: `${STAGE_H}px`,
            transform: `scale(${stageScale})`,
          }}
        >
          <div className={styles.stage}>
            <header className={styles.topBar}>
              <button className={styles.topBtn} onClick={() => router.back()}>
                رجوع
              </button>

              <div className={styles.topTitle}>خلية الحروف</div>

              <button
                className={`${styles.topBtn} ${styles.primaryBtn}`}
                onClick={() => window.location.reload()}
              >
                لعبة جديدة
              </button>
            </header>

            {!gameStarted ? (
              <div className={styles.teamsScreen}>
                <div className={styles.teamsCard}>
                  <h2>ابدأ خلية الحروف</h2>

                  <button
                    className={styles.startBtn}
                    onClick={startLocalGame}
                    type="button"
                  >
                    ابدأ اللعبة
                  </button>

                  <button
                    className={styles.startBtn}
                    onClick={startWebGame}
                    type="button"
                    style={{ marginTop: 12 }}
                  >
                    ابدأ اللعبة بالموقع
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.main}>
                <section className={styles.leftBoard}>
                  <div className={styles.leftInner}>
                    <LettersBoard onPickLetter={(letter) => startCountdown(letter)} />
                  </div>
                </section>

                <section className={styles.rightSide}>
                  <div className={styles.questionCard}>
                    <div className={styles.questionTitle}>
                      السؤال{pickedLetter ? ` — (${pickedLetter})` : ""}
                    </div>

                    <div className={styles.questionBody}>
                      {phase === "countdown" ? (
                        <div className={styles.countdownNum}>{seconds}</div>
                      ) : phase === "question" ? (
                        <>
                          <div>{questionText}</div>

                          {showAnswer ? (
                            <div className={styles.answerHint}>
                              {answerText ? `(إجابة: ${answerText})` : ""}
                            </div>
                          ) : (
                            <button
                              type="button"
                              className={styles.startBtn}
                              onClick={handleShowAnswer}
                              style={{ marginTop: 18 }}
                            >
                              إظهار الإجابة
                            </button>
                          )}
                        </>
                      ) : (
                        <div>هنا يظهر السؤال…</div>
                      )}
                    </div>

                    <div className={styles.teamNames}>
                      <div className={styles.teamItem}>
                        <span className={styles.greenDotInline} />
                        <span className={styles.greenTeam}>{greenTeam}</span>
                      </div>

                      <div className={styles.teamItem}>
                        <span className={styles.redDotInline} />
                        <span className={styles.redTeam}>{redTeam}</span>
                      </div>
                    </div>

                    <div className={styles.rulesBox}>
                      <div className={styles.rulesTitle}>طريقة اللعب:</div>
                      <div className={styles.rulesLine}>• ضغطة على الخلية = وميض</div>
                      <div className={styles.rulesLine}>• ضغطتان = يظهر السؤال</div>
                      <div className={styles.rulesLine}>• الضغطة الثالثة = تلوين الخلية</div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {modalText && (
              <div className={styles.modal} onClick={() => setModalText(null)}>
                <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
                  {modalText}
                </div>
              </div>
            )}

            {webCodeModalOpen && (
              <div className={styles.modal} onClick={() => setWebCodeModalOpen(false)}>
                <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.webModalTitle}>ابدأ اللعبة بالموقع</div>
                  <div className={styles.webModalText}>
                    هذا كود اللعبة. افتح موقع مستوى في الشاشة الثانية ثم أدخل الكود لعرض خلية الحروف.
                  </div>

                  <div className={styles.webFieldLabel}>الكود</div>
                  <textarea
                    className={styles.webTextarea}
                    readOnly
                    value={generatedWebCode}
                  />

                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() => copyText(generatedWebCode)}
                  >
                    نسخ الكود
                  </button>

                  <div className={styles.webFieldLabel}>صفحة الدخول</div>
                  <textarea
                    className={styles.webTextarea}
                    readOnly
                    value={generatedWebUrl}
                  />

                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() => copyText(generatedWebUrl)}
                  >
                    نسخ الرابط
                  </button>

                  <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={() => setWebCodeModalOpen(false)}
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}