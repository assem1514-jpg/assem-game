"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./page.module.css";

import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  documentId,
  doc,
  onSnapshot,
  limit,
  updateDoc,
} from "firebase/firestore";
import { Icon } from "@iconify/react";

type Team = { name: string; score: number; icon?: string };
type CatMeta = { id: string; name: string; imageUrl?: string };

const LS_KEY = "assem_game_v1";
const POINTS_ROWS: Array<200 | 400 | 600> = [600, 400, 200];

/* مقاس تصميم ثابت للوحة اللعبة */
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
  if (typeof window === "undefined") return;
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

  const [mounted, setMounted] = useState(false);
  const [game, setGame] = useState<any | null>(null);
  const [activePackId, setActivePackId] = useState<string>("main");
  const [turnIndex, setTurnIndex] = useState<number>(0);
  const [openRoundEnd, setOpenRoundEnd] = useState(false);
  const [sessionDocId, setSessionDocId] = useState<string>("");

  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  const rawCats = normalizeCatsParam(sp.get("cats") || "");
  const sessionCode = (sp.get("session") || "").trim().toUpperCase();

  async function persistGame(updatedGame: any) {
    saveGame(updatedGame);
    setGame(updatedGame);
    setTurnIndex(Number(updatedGame?.turnIndex ?? 0) || 0);

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
    const cfgRef = doc(db, "appConfig", "main");
    const unsub = onSnapshot(cfgRef, (snap) => {
      const data = snap.data() as any;
      setActivePackId(data?.activePackId || "main");
    });

    return () => unsub();
  }, []);

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
        setTurnIndex(Number(initialGame?.turnIndex ?? 0) || 0);
        setMounted(true);
      }
    }

    initGame();

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

  const catIds = useMemo(() => {
    const sourceCats =
      rawCats ||
      (Array.isArray(game?.cats) ? game.cats.join(",") : "");

    const arr = sourceCats
      .split(",")
      .map((x: string) => x.trim())
      .filter((x: string) => Boolean(x));

    const seen = new Set<string>();
    const unique: string[] = [];
    for (const id of arr) {
      if (!seen.has(id)) {
        seen.add(id);
        unique.push(id);
      }
    }
    return unique;
  }, [rawCats, game?.cats]);

  const teams: Team[] = (game?.teams || []) as Team[];
  const safeTurnIndex = teams.length ? Math.min(turnIndex, teams.length - 1) : 0;
  const currentTeam = teams[safeTurnIndex];
  const used: Record<string, boolean> = (game?.used || {}) as Record<string, boolean>;

  const [catsMeta, setCatsMeta] = useState<Record<string, CatMeta>>({});
  const [hasQuestion, setHasQuestion] = useState<Record<string, boolean>>({});
  const [questionsReady, setQuestionsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!catIds.length) return;

      try {
        const q1 = query(
          collection(db, "packs", activePackId, "categories"),
          where(documentId(), "in", catIds.slice(0, 10))
        );

        const snap = await getDocs(q1);
        const map: Record<string, CatMeta> = {};

        snap.forEach((d) => {
          const data = d.data() as any;
          map[d.id] = {
            id: d.id,
            name: (data.name ?? "").toString().trim(),
            imageUrl: (data.imageUrl ?? "").toString().trim(),
          };
        });

        if (!cancelled) setCatsMeta(map);
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catIds.join("|"), activePackId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setQuestionsReady(false);
      if (!catIds.length) return;

      const hasMap: Record<string, boolean> = {};

      try {
        for (const catId of catIds) {
          const snap = await getDocs(
            collection(db, "packs", activePackId, "categories", catId, "questions")
          );

          const counts: Record<number, number> = { 200: 0, 400: 0, 600: 0 };

          snap.forEach((d) => {
            const data = d.data() as any;
            const pts = Number(data.points || 0);
            if (![200, 400, 600].includes(pts)) return;
            counts[pts] = (counts[pts] || 0) + 1;
          });

          for (const pts of [200, 400, 600] as const) {
            hasMap[`${catId}:${pts}:0`] = (counts[pts] || 0) >= 1;
            hasMap[`${catId}:${pts}:1`] = (counts[pts] || 0) >= 2;
          }
        }
      } catch (e) {
        console.error(e);
      }

      if (!cancelled) {
        setHasQuestion(hasMap);
        setQuestionsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catIds.join("|"), activePackId]);

  const playableKeys = useMemo(() => {
    const keys: string[] = [];
    for (const catId of catIds) {
      for (const pts of [200, 400, 600] as const) {
        for (const idx of [0, 1] as const) {
          const k = `${catId}:${pts}:${idx}`;
          if (hasQuestion[k]) keys.push(k);
        }
      }
    }
    return keys;
  }, [catIds.join("|"), hasQuestion]);

  const roundFinished = useMemo(() => {
    if (!questionsReady) return false;
    if (!playableKeys.length) return false;
    return playableKeys.every((k: string) => !!used[k]);
  }, [questionsReady, playableKeys, used]);

  useEffect(() => {
    if (!mounted) return;
    if (!game) return;

    if (roundFinished) setOpenRoundEnd(true);
    if (!roundFinished) setOpenRoundEnd(false);
  }, [roundFinished, mounted, game]);

  const winners = useMemo(() => {
    const list = (teams || []).map((t: Team) => ({
      name: (t?.name || "").trim() || "فريق",
      score: Number(t?.score || 0),
      icon: t?.icon,
    }));
    if (!list.length) return { max: 0, winners: [] as typeof list };

    const max = Math.max(...list.map((x: { score: number }) => x.score));
    const w = list.filter((x: { score: number }) => x.score === max);
    return { max, winners: w };
  }, [teams]);

  function openQuestion(catId: string, pts: number, idx: number) {
    const sessionPart = sessionCode ? `&session=${encodeURIComponent(sessionCode)}` : "";
    router.push(
      `/game/question?cat=${catId}&pts=${pts}&idx=${idx}&cats=${catIds.join(",")}${sessionPart}`
    );
  }

  async function nextTurn() {
    if (!teams.length) return;
    const next = (safeTurnIndex + 1) % teams.length;
    setTurnIndex(next);

    const g = loadGame();
    const merged = { ...(g || {}), turnIndex: next };
    await persistGame(merged);
  }

  async function updateTeamScore(teamIdx: number, diff: number) {
    const g = loadGame() || {};
    const currentTeams = Array.isArray(g.teams) ? g.teams : [];

    const updatedTeams = currentTeams.map((t: Team, idx: number) => {
      if (idx !== teamIdx) return t;
      return {
        ...t,
        score: Math.max(0, Number(t.score || 0) + diff),
      };
    });

    const updated = { ...g, teams: updatedTeams };
    await persistGame(updated);
  }

  async function newRoundKeepScores() {
    const g = loadGame() || {};
    const updated = { ...g };
    updated.used = {};
    updated.seenQuestions = {};
    updated.turnIndex = 0;

    await persistGame(updated);
    setOpenRoundEnd(false);
  }

  async function newRoundResetScores() {
    const g = loadGame() || {};
    const updated = { ...g };
    updated.used = {};
    updated.seenQuestions = {};
    updated.turnIndex = 0;
    updated.teams = (updated.teams || []).map((t: Team) => ({ ...t, score: 0 }));

    await persistGame(updated);
    setOpenRoundEnd(false);
  }

  const firstTeam = teams[0];
  const secondTeam = teams[1];
  const extraTeams = teams.slice(2);

  if (!mounted) return null;
  if (!game) return <div style={{ padding: 24 }}>ما فيه لعبة شغالة.</div>;

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
            <header className={styles.topBar}>
              <div className={styles.leftBtns}>
                <Link className={styles.smallBtn} href="/categories">
                  <Icon icon="mdi:logout" width={18} height={18} />
                  الخروج
                </Link>
              </div>

              <div className={styles.logoCenter}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.headerLogo} src="/logo.png" alt="مستوى" />
              </div>

              <div className={styles.turnWrap}>
                <div className={styles.turnPill}>
                  <span>دور فريق:</span>
                  <strong>{currentTeam?.name || `الفريق ${safeTurnIndex + 1}`}</strong>
                  <button className={styles.turnBtn} type="button" onClick={nextTurn} title="تبديل الدور">
                    <Icon icon="mdi:swap-horizontal" width={18} height={18} />
                  </button>
                </div>
              </div>
            </header>

            <main className={styles.boardWrap}>
              <div className={styles.boardArea}>
                <div
                  className={styles.board}
                  style={{ gridTemplateColumns: `repeat(${catIds.length}, minmax(0, 1fr))` }}
                >
                  {catIds.map((catId) => {
                    const meta = catsMeta[catId];

                    return (
                      <div key={catId} className={styles.categoryCard}>
                        <div className={styles.catMedia}>
                          {meta?.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img className={styles.catImg} src={meta.imageUrl} alt={meta.name} />
                          ) : (
                            <div className={styles.catImgFallback} />
                          )}

                          <div className={styles.catNameOverlay}>
                            <div className={styles.catName}>{meta?.name || "..."}</div>
                          </div>
                        </div>

                        {POINTS_ROWS.map((pts) => (
                          <div key={`${catId}-${pts}`} className={styles.pointsRow}>
                            {[0, 1].map((idx) => {
                              const key = `${catId}:${pts}:${idx}`;
                              const enabled = !!hasQuestion[key];
                              const isUsed = !!used[key];

                              return (
                                <button
                                  key={key}
                                  className={`${styles.cell} ${styles[`pts${pts}`]} ${isUsed ? styles.used : ""}`}
                                  onClick={() => enabled && !isUsed && openQuestion(catId, pts, idx)}
                                  disabled={!questionsReady || !enabled || isUsed}
                                  type="button"
                                >
                                  <span className={styles.cellValue}>{pts}</span>
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={styles.teamsBar}>
                <div className={styles.teamsMain}>
                  {firstTeam ? (
                    <div className={`${styles.teamCard} ${0 === safeTurnIndex ? styles.teamActive : ""}`}>
                      <div className={styles.teamManualCol}>
                        <button
                          type="button"
                          className={styles.scoreBtn}
                          onClick={() => updateTeamScore(0, 100)}
                          title="زيادة 100"
                        >
                          <Icon icon="mdi:plus" width={18} height={18} />
                        </button>
                        <button
                          type="button"
                          className={styles.scoreBtn}
                          onClick={() => updateTeamScore(0, -100)}
                          title="خصم 100"
                        >
                          <Icon icon="mdi:minus" width={18} height={18} />
                        </button>
                      </div>

                      <div className={styles.teamAvatar}>
                        {firstTeam.icon ? (
                          <Icon icon={firstTeam.icon} width={38} height={38} />
                        ) : (
                          <Icon icon="mdi:account-group" width={34} height={34} />
                        )}
                      </div>

                      <div className={styles.teamCenter}>
                        <div className={styles.teamName}>{firstTeam.name || "الفريق 1"}</div>
                        <div className={styles.teamScoreLine}>
                          نقاطنا: <span className={styles.teamScoreNum}>{Number(firstTeam.score || 0)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div />
                  )}

                  <div className={styles.teamsCenterLogo}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className={styles.teamsLogo} src="/logo.png" alt="مستوى" />
                  </div>

                  {secondTeam ? (
                    <div className={`${styles.teamCard} ${1 === safeTurnIndex ? styles.teamActive : ""}`}>
                      <div className={styles.teamCenter}>
                        <div className={styles.teamName}>{secondTeam.name || "الفريق 2"}</div>
                        <div className={styles.teamScoreLine}>
                          نقاطنا: <span className={styles.teamScoreNum}>{Number(secondTeam.score || 0)}</span>
                        </div>
                      </div>

                      <div className={styles.teamAvatar}>
                        {secondTeam.icon ? (
                          <Icon icon={secondTeam.icon} width={38} height={38} />
                        ) : (
                          <Icon icon="mdi:account-group" width={34} height={34} />
                        )}
                      </div>

                      <div className={styles.teamManualCol}>
                        <button
                          type="button"
                          className={styles.scoreBtn}
                          onClick={() => updateTeamScore(1, 100)}
                          title="زيادة 100"
                        >
                          <Icon icon="mdi:plus" width={18} height={18} />
                        </button>
                        <button
                          type="button"
                          className={styles.scoreBtn}
                          onClick={() => updateTeamScore(1, -100)}
                          title="خصم 100"
                        >
                          <Icon icon="mdi:minus" width={18} height={18} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div />
                  )}
                </div>

                {extraTeams.length > 0 && (
                  <div className={styles.extraTeamsRow}>
                    {extraTeams.map((t, extraIdx) => {
                      const realIdx = extraIdx + 2;
                      return (
                        <div
                          key={realIdx}
                          className={`${styles.teamCard} ${realIdx === safeTurnIndex ? styles.teamActive : ""}`}
                        >
                          <div className={styles.teamManualCol}>
                            <button
                              type="button"
                              className={styles.scoreBtn}
                              onClick={() => updateTeamScore(realIdx, 100)}
                              title="زيادة 100"
                            >
                              <Icon icon="mdi:plus" width={18} height={18} />
                            </button>
                            <button
                              type="button"
                              className={styles.scoreBtn}
                              onClick={() => updateTeamScore(realIdx, -100)}
                              title="خصم 100"
                            >
                              <Icon icon="mdi:minus" width={18} height={18} />
                            </button>
                          </div>

                          <div className={styles.teamAvatar}>
                            {t.icon ? (
                              <Icon icon={t.icon} width={34} height={34} />
                            ) : (
                              <Icon icon="mdi:account-group" width={30} height={30} />
                            )}
                          </div>

                          <div className={styles.teamCenter}>
                            <div className={styles.teamName}>{t.name || `الفريق ${realIdx + 1}`}</div>
                            <div className={styles.teamScoreLine}>
                              نقاطنا: <span className={styles.teamScoreNum}>{Number(t.score || 0)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </main>

            {openRoundEnd && (
              <div className={styles.roundBackdrop} onClick={() => setOpenRoundEnd(false)}>
                <div className={styles.roundCard} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.roundHeader}>
                    <div className={styles.roundBadge}>🏆</div>
                    <div>
                      <div className={styles.roundTitle}>انتهت الجولة!</div>
                      <div className={styles.roundSub}>
                        {winners.winners.length > 1 ? "تعادل على المركز الأول" : "الفريق الفائز"}
                      </div>
                    </div>
                  </div>

                  <div className={styles.roundWinners}>
                    {winners.winners.map((w, i) => (
                      <div key={i} className={styles.winnerChip}>
                        <span className={styles.winnerName}>{w.name}</span>
                        <span className={styles.winnerScore}>{w.score}</span>
                      </div>
                    ))}
                  </div>

                  <div className={styles.roundHint}>
                    أعلى نتيجة: <b>{winners.max}</b> نقطة
                  </div>

                  <div className={styles.roundActions}>
                    <button type="button" className={styles.roundBtnPrimary} onClick={newRoundKeepScores}>
                      جولة جديدة (نفس النقاط)
                    </button>

                    <button type="button" className={styles.roundBtnSecondary} onClick={newRoundResetScores}>
                      جولة جديدة (تصفير النقاط)
                    </button>

                    <button type="button" className={styles.roundBtnGhost} onClick={() => setOpenRoundEnd(false)}>
                      إغلاق
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}