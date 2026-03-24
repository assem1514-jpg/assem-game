"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./page.module.css";

import { db } from "@/lib/firebase";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  query,
  where,
  limit,
  updateDoc,
} from "firebase/firestore";
import { Icon } from "@iconify/react";
import { useAuth } from "@/lib/authContext";

type Team = { name: string; score: number; icon?: string };

const LS_KEY = "assem_game_v1";
const DEFAULT_SECONDS = 60;
const STAGE_W = 1600;
const STAGE_H = 900;

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
  answerFirstLetter?: string;
  _id?: string;
  _catId?: string;
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

function pickRandom<T>(arr: T[]) {
  if (!arr.length) return null;
  const i = Math.floor(Math.random() * arr.length);
  return arr[i] ?? null;
}

function parseCatIdFromQuestionPath(path: string) {
  const parts = (path || "").split("/");
  const i = parts.findIndex((p) => p === "categories");
  if (i >= 0 && parts[i + 1]) return parts[i + 1];
  return "";
}

export default function QuestionPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { user } = useAuth();

  const catId = sp.get("cat") || "";
  const pts = Number(sp.get("pts") || 0);
  const idx = Number(sp.get("idx") || 0);
  const catsParam = normalizeCatsParam(sp.get("cats") || "");
  const sessionCode = (sp.get("session") || "").trim().toUpperCase();

  const [game, setGame] = useState<any | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  const [loading, setLoading] = useState(true);
  const [question, setQuestion] = useState<QuestionDoc | null>(null);

  const [catName, setCatName] = useState<string>("");

  const [secondsLeft, setSecondsLeft] = useState<number>(DEFAULT_SECONDS);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  const [openHelp, setOpenHelp] = useState(false);
  const [activeLifelines, setActiveLifelines] = useState<{ twoAnswers: boolean; callFriend: boolean }>({
    twoAnswers: false,
    callFriend: false,
  });

  const [openImage, setOpenImage] = useState(false);
  const [openWinners, setOpenWinners] = useState(false);

  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [sessionDocId, setSessionDocId] = useState<string>("");

  async function persistGame(updatedGame: any) {
    saveGame(updatedGame);
    setGame(updatedGame);

    if (sessionDocId) {
      try {
        await updateDoc(doc(db, "sessions", sessionDocId), {
          gameData: updatedGame,
        });
      } catch (e) {
        console.error(e);
      }
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function initGame() {
      let initialGame: any | null = null;
      let foundSessionDocId = "";

      if (sessionCode) {
        try {
          const q = query(
            collection(db, "sessions"),
            where("code", "==", sessionCode),
            where("isActive", "==", true),
            limit(1)
          );

          const snap = await getDocs(q);

          if (!snap.empty) {
            foundSessionDocId = snap.docs[0].id;
            const sessionData = snap.docs[0].data() as any;
            const expiresAt = Number(sessionData?.expiresAt ?? 0);

            if (expiresAt && Date.now() <= expiresAt && sessionData?.gameData) {
              initialGame = sessionData.gameData;
              saveGame(initialGame);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }

      if (!initialGame) {
        initialGame = loadGame();
      }

      if (!cancelled) {
        setSessionDocId(foundSessionDocId);
        setGame(initialGame);
      }
    }

    initGame();

    return () => {
      cancelled = true;
    };
  }, [sessionCode]);

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
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

  const currentTeamIndex = Number(game?.turnIndex ?? 0);
  const currentTeam: Team | undefined = game?.teams?.[currentTeamIndex];
  const packId = (game?.packId || "main").toString();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!catId) {
        setCatName("");
        return;
      }
      try {
        const ref = doc(db, "packs", packId, "categories", catId);
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
  }, [catId, packId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!catId || !pts || !game) {
        setQuestion(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setShowAnswer(false);
      setOpenHelp(false);
      setOpenImage(false);
      setOpenWinners(false);

      setSecondsLeft(DEFAULT_SECONDS);
      setTimerRunning(false);
      setActiveLifelines({ twoAnswers: false, callFriend: false });

      try {
        const allSnap = await getDocs(collection(db, "packs", packId, "categories", catId, "questions"));

        const allCandidates: QuestionDoc[] = [];
        allSnap.forEach((d) => {
          const data = d.data() as any;
          const p = Number(data.points ?? 0);
          if (p !== pts) return;

          allCandidates.push({
            _id: d.id,
            _catId: catId,
            text: data.text ?? "",
            points: p,
            imageUrl: data.imageUrl ?? "",
            answerText: data.answerText ?? "",
            answerImageUrl: data.answerImageUrl ?? "",
            answerFirstLetter:
              (data.answerFirstLetter ?? data.firstLetter ?? data.answerLetter ?? data.firstChar ?? "")?.toString() ?? "",
          });
        });

        const localSeen: Record<string, true> = game?.seenQuestions || {};
        const localSeenKeyPrefix = `${packId}:${catId}:${pts}:`;
        const localSeenIds = new Set(
          Object.keys(localSeen)
            .filter((k) => k.startsWith(localSeenKeyPrefix))
            .map((k) => k.split(":").slice(-1)[0])
        );

        let userSeenIds = new Set<string>();
        if (user?.uid) {
          try {
            const qs = query(
              collection(db, "users", user.uid, "seenQuestions"),
              where("packId", "==", packId),
              where("catId", "==", catId),
              where("points", "==", pts)
            );
            const seenSnap = await getDocs(qs);
            seenSnap.forEach((sd) => {
              const dd = sd.data() as any;
              if (dd?.qid) userSeenIds.add(String(dd.qid));
            });
          } catch {
            try {
              const seenSnap = await getDocs(collection(db, "users", user.uid, "seenQuestions"));
              seenSnap.forEach((sd) => {
                const dd = sd.data() as any;
                if (dd?.packId === packId && dd?.catId === catId && Number(dd?.points ?? 0) === pts) {
                  if (dd?.qid) userSeenIds.add(String(dd.qid));
                }
              });
            } catch {}
          }
        }

        const filtered = allCandidates.filter((c) => {
          const id = c._id || "";
          if (!id) return false;
          if (localSeenIds.has(id)) return false;
          if (userSeenIds.has(id)) return false;
          return true;
        });

        let chosen = pickRandom(filtered);

        if (!chosen) {
          const filteredLocalOnly = allCandidates.filter((c) => {
            const id = c._id || "";
            if (!id) return false;
            if (localSeenIds.has(id)) return false;
            return true;
          });
          chosen = pickRandom(filteredLocalOnly) || pickRandom(allCandidates);
        }

        if (!chosen) {
          if (!cancelled) {
            setQuestion(null);
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          const updated = { ...(game || {}) };
          updated.seenQuestions = updated.seenQuestions || {};
          updated.seenQuestions[`${localSeenKeyPrefix}${chosen._id}`] = true;
          await persistGame(updated);
        }

        if (user?.uid && chosen._id) {
          try {
            const seenId = `${catId}_${pts}_${chosen._id}`;
            await setDoc(
              doc(db, "users", user.uid, "seenQuestions", seenId),
              { packId, catId, qid: chosen._id, points: pts, seenAt: serverTimestamp() },
              { merge: true }
            );
          } catch {}
        }

        if (!cancelled) {
          setQuestion(chosen);
          setLoading(false);
          setTimerRunning(true);
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
  }, [catId, pts, user?.uid, packId, game?.startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!timerRunning) return;
    if (showAnswer) return;
    if (!question) return;

    const t = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);

    return () => clearInterval(t);
  }, [timerRunning, showAnswer, question]);

  useEffect(() => {
    if (!question) return;
    if (showAnswer) return;
    if (secondsLeft === 0) setTimerRunning(false);
  }, [secondsLeft, question, showAnswer]);

  const catTitle = useMemo(() => ((catName || "").trim() ? catName : "…"), [catName]);

  function backToBoard() {
    const sessionPart = sessionCode ? `&session=${encodeURIComponent(sessionCode)}` : "";
    router.push(`/game?cats=${encodeURIComponent(catsParam)}${sessionPart}`);
  }

  async function markUsed(updatedGame: any, advanceTurn: boolean) {
    updatedGame.used = updatedGame.used || {};
    updatedGame.used[`${catId}:${pts}:${idx}`] = true;

    if (advanceTurn) {
      const n = updatedGame.teams?.length || 0;
      if (n > 0) updatedGame.turnIndex = ((updatedGame.turnIndex ?? 0) + 1) % n;
    }

    await persistGame(updatedGame);
  }

  async function markUsedAndBack(updatedGame: any) {
    await markUsed(updatedGame, true);
    backToBoard();
  }

  async function awardToTeam(teamIndex: number) {
    if (!game) return;
    const updated = { ...game };
    updated.teams = (updated.teams || []).map((t: Team, i: number) =>
      i === teamIndex ? { ...t, score: (t.score || 0) + pts } : t
    );
    setOpenWinners(false);
    await markUsedAndBack(updated);
  }

  async function nobodyAnswered() {
    if (!game) return;
    const updated = { ...game };
    setOpenWinners(false);
    await markUsedAndBack(updated);
  }

  async function showAnswerNow() {
    if (!game) return;
    setShowAnswer(true);
    setTimerRunning(false);

    const updated = { ...game };
    await markUsed(updated, false);
  }

  function backToQuestionView() {
    setShowAnswer(false);
    setOpenWinners(false);
    if (question && secondsLeft > 0) setTimerRunning(true);
  }

  async function useTwoAnswers() {
    if (!game) return;
    const updated = { ...game };
    setLifelines(updated, currentTeamIndex, { twoAnswers: true });
    await persistGame(updated);
    setActiveLifelines((p) => ({ ...p, twoAnswers: true }));
  }

  async function useCallFriend() {
    if (!game) return;
    const updated = { ...game };
    setLifelines(updated, currentTeamIndex, { callFriend: true });
    await persistGame(updated);
    setActiveLifelines((p) => ({ ...p, callFriend: true }));
  }

  async function changeQuestionAny() {
    if (!pts) return;
    try {
      setLoading(true);
      setShowAnswer(false);
      setOpenImage(false);
      setOpenWinners(false);
      setSecondsLeft(DEFAULT_SECONDS);
      setTimerRunning(false);

      const qRef = query(collectionGroup(db, "questions"), where("points", "==", pts), limit(60));
      const snap = await getDocs(qRef);

      const pool: QuestionDoc[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        const qid2 = d.id;
        const catId2 = parseCatIdFromQuestionPath(d.ref.path);

        pool.push({
          _id: qid2,
          _catId: catId2,
          text: data.text ?? "",
          points: Number(data.points ?? pts),
          imageUrl: data.imageUrl ?? "",
          answerText: data.answerText ?? "",
          answerImageUrl: data.answerImageUrl ?? "",
          answerFirstLetter:
            (data.answerFirstLetter ?? data.firstLetter ?? data.answerLetter ?? data.firstChar ?? "")?.toString() ?? "",
        });
      });

      const picked = pickRandom(pool);

      if (!picked) {
        alert("ما لقيت سؤال بنفس النقاط.");
        setLoading(false);
        return;
      }

      if (picked._catId) {
        try {
          const cSnap = await getDoc(doc(db, "packs", packId, "categories", picked._catId));
          if (cSnap.exists()) {
            const cd = cSnap.data() as any;
            const name = (cd?.name ?? cd?.title ?? cd?.catName ?? "").toString().trim();
            setCatName(name || "");
          }
        } catch {}
      }

      const updated = { ...(game || {}) };
      updated.seenQuestions = updated.seenQuestions || {};
      const prefix = `${packId}:${picked._catId || "any"}:${pts}:`;
      if (picked._id) updated.seenQuestions[`${prefix}${picked._id}`] = true;
      await persistGame(updated);

      if (user?.uid && picked._id) {
        try {
          const seenId = `${picked._catId || "any"}_${pts}_${picked._id}`;
          await setDoc(
            doc(db, "users", user.uid, "seenQuestions", seenId),
            { packId, catId: picked._catId || "any", qid: picked._id, points: pts, seenAt: serverTimestamp() },
            { merge: true }
          );
        } catch {}
      }

      setQuestion(picked);
      setLoading(false);
      setTimerRunning(true);
      setOpenHelp(false);
    } catch (e) {
      console.error(e);
      alert("صار خطأ أثناء تغيير السؤال");
      setLoading(false);
    }
  }

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
      <div className={styles.page}>
        <div className={styles.fitWrap}>
          <div
            className={styles.stageScale}
            style={{ width: `${STAGE_W}px`, height: `${STAGE_H}px`, transform: `scale(${stageScale})` }}
          >
            <div className={styles.stage} style={{ display: "grid", placeItems: "center" }}>
              ما فيه لعبة شغالة. ارجع للفئات وابدأ لعبة جديدة.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const lifelines = getLifelines(game, currentTeamIndex);

  return (
    <div className={styles.page}>
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
            <header className={styles.fanousHeader}>
              <div className={styles.turnPill}>
                <span>دور الفريق:</span>
                <b style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {currentTeam?.icon ? renderTeamIcon(currentTeam.icon, 18) : null}
                  {currentTeam?.name ?? "—"}
                </b>
              </div>

              <div className={styles.brandCenter}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.bigLogo} src="/logo.png" alt="logo" />
              </div>

              <button className={styles.closeBtn} onClick={backToBoard} type="button" title="إغلاق">
                ✕
              </button>
            </header>

            <main className={styles.mainWrap}>
              <section className={styles.questionShell}>
                <div className={styles.shellTopRow}>
                  <div className={styles.pointsPill}>{pts} نقطة</div>

                  <div className={styles.timerPill}>
                    <button
                      type="button"
                      onClick={toggleTimer}
                      disabled={!question || showAnswer || secondsLeft === 0}
                      title={timerRunning ? "إيقاف" : "تشغيل"}
                      className={styles.timerIconBtn}
                    >
                      <Icon icon={timerRunning ? "mdi:pause" : "mdi:play"} width="22" height="22" />
                    </button>

                    <div className={styles.timerText}>{formatMMSS(secondsLeft)}</div>

                    <button
                      type="button"
                      onClick={resetTimer}
                      disabled={!question || showAnswer}
                      title="إعادة"
                      className={styles.timerIconBtn}
                    >
                      <Icon icon="mdi:restart" width="22" height="22" />
                    </button>
                  </div>

                  <button
                    type="button"
                    className={styles.fazaaBtn}
                    onClick={() => setOpenHelp(true)}
                    disabled={!question || showAnswer}
                    title="فزعة ارتشاف"
                  >
                    فزعة ارتشاف
                  </button>
                </div>

                <div className={styles.catTitleBar}>{catTitle}</div>

                {loading ? (
                  <div className={styles.qTitle}>جاري التحميل…</div>
                ) : !question ? (
                  <div className={styles.qTitle}>ما فيه سؤال بهذه النقاط داخل هذه الفئة.</div>
                ) : !showAnswer ? (
                  <div className={styles.qTitle}>{question.text}</div>
                ) : (
                  <div className={styles.qTitle} style={{ fontSize: 34 }}>
                    {question.answerText || "—"}
                  </div>
                )}

                <div className={styles.contentArea}>
                  {!loading && question ? (
                    !showAnswer ? (
                      question.imageUrl ? (
                        <div className={styles.mediaWrap}>
                          <div className={styles.mediaSmall}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={question.imageUrl} alt="question" />
                          </div>

                          <button
                            type="button"
                            className={styles.zoomBtn}
                            onClick={() => setOpenImage(true)}
                            title="تكبير الصورة"
                          >
                            تكبير الصورة
                          </button>
                        </div>
                      ) : (
                        <div className={styles.emptyMedia}>بدون صورة</div>
                      )
                    ) : question.answerImageUrl ? (
                      <div className={styles.mediaWrap}>
                        <div className={styles.mediaSmall}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={question.answerImageUrl} alt="answer" />
                        </div>

                        <button
                          type="button"
                          className={styles.zoomBtn}
                          onClick={() => setOpenImage(true)}
                          title="تكبير الصورة"
                        >
                          تكبير الصورة
                        </button>
                      </div>
                    ) : (
                      <div className={styles.emptyMedia}>بدون صورة</div>
                    )
                  ) : null}
                </div>

                {!loading && question ? (
                  !showAnswer ? (
                    <div className={styles.bottomActions}>
                      <button className={styles.backBtn} onClick={backToBoard} type="button">
                        رجوع
                      </button>

                      <button className={styles.answerBtn} onClick={showAnswerNow} type="button">
                        الإجابة
                      </button>
                    </div>
                  ) : (
                    <div className={styles.bottomActions}>
                      <button className={styles.backBtn} onClick={backToQuestionView} type="button">
                        الرجوع للسؤال
                      </button>

                      <button className={styles.whoBtn} onClick={() => setOpenWinners(true)} type="button">
                        من جاوب صح؟
                      </button>
                    </div>
                  )
                ) : null}
              </section>
            </main>

            {openHelp && (
              <div className={styles.modalBackdrop} onClick={() => setOpenHelp(false)}>
                <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.modalTitle}>فزعة ارتشاف</div>
                  <div className={styles.modalSub}>اختر وسيلة مساعدة (تتطبق على هذا السؤال فقط)</div>

                  <div className={styles.helpGrid}>
                    <button
                      type="button"
                      onClick={() => {
                        useTwoAnswers();
                        setOpenHelp(false);
                      }}
                      disabled={!question || showAnswer || lifelines.twoAnswers}
                      className={styles.helpBtn}
                    >
                      <span>فعل إجابتين</span>
                      <Icon icon="mdi:numeric-2-circle" width="22" height="22" />
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        await changeQuestionAny();
                      }}
                      disabled={!question || showAnswer}
                      className={styles.helpBtn}
                    >
                      <span>غيّر السؤال</span>
                      <Icon icon="mdi:shuffle-variant" width="22" height="22" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        useCallFriend();
                        setOpenHelp(false);
                      }}
                      disabled={!question || showAnswer || lifelines.callFriend}
                      className={styles.helpBtn}
                    >
                      <span>اتصال بصديق</span>
                      <Icon icon="mdi:phone" width="22" height="22" />
                    </button>
                  </div>

                  <button type="button" className={styles.modalCancel} onClick={() => setOpenHelp(false)}>
                    إغلاق
                  </button>
                </div>
              </div>
            )}

            {openWinners && (
              <div className={styles.modalBackdrop} onClick={() => setOpenWinners(false)}>
                <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.modalTitle}>الفريق اللي جاوب صح</div>
                  <div className={styles.modalSub}>اختر الفريق اللي جاوب صح (أو محد جاوب)</div>

                  <div className={styles.winnersGrid}>
                    {(game?.teams || []).map((t: Team, i: number) => (
                      <button
                        key={i}
                        className={styles.winnerBtn}
                        onClick={() => awardToTeam(i)}
                        type="button"
                        disabled={!showAnswer || !question}
                      >
                        {t.icon ? <span style={{ marginInlineEnd: 8 }}>{renderTeamIcon(t.icon, 18)}</span> : null}
                        {t.name}
                      </button>
                    ))}
                  </div>

                  <button className={styles.nobodyBtnModal} onClick={nobodyAnswered} type="button" disabled={!question || !showAnswer}>
                    محد جاوب
                  </button>

                  <button type="button" className={styles.modalCancel} onClick={() => setOpenWinners(false)}>
                    إغلاق
                  </button>
                </div>
              </div>
            )}

            {openImage && question && (
              <div className={styles.imageBackdrop} onClick={() => setOpenImage(false)}>
                <div className={styles.imageFrame} onClick={(e) => e.stopPropagation()}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={!showAnswer ? (question.imageUrl || "") : (question.answerImageUrl || "")}
                    alt="zoom"
                    className={styles.imageFull}
                  />
                  <button type="button" className={styles.imageClose} onClick={() => setOpenImage(false)}>
                    إغلاق
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}