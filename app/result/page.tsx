"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { Icon } from "@iconify/react";

type ResultTeam = {
  index: number;
  name: string;
  score: number;
  icon?: string;
};

type ResultData = {
  endedAt: number;
  packId?: string;
  cats?: string[];
  teams: ResultTeam[];
  winners: ResultTeam[];
  max: number;
  gameData?: any;
};

const LS_KEY = "assem_game_v1";
const LS_RESULT_KEY = "mstawaa_result_v1";

function loadResult(): ResultData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_RESULT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

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

function renderTeamIcon(icon?: string, size = 30) {
  if (!icon) return <Icon icon="mdi:account-group" width={size} height={size} />;
  if (icon.includes(":")) return <Icon icon={icon} width={size} height={size} />;
  return <span>{icon}</span>;
}

export default function ResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<ResultData | null>(null);

  useEffect(() => {
    setResult(loadResult());
  }, []);

  const teams = useMemo(() => {
    return [...(result?.teams || [])].sort((a, b) => b.score - a.score);
  }, [result]);

  const winner = teams[0] || null;
  const losers = teams.slice(1);
  const second = teams[1] || null;
  const isTie = result?.winners && result.winners.length > 1;

  function playAgainKeepScores() {
    const game = loadGame() || result?.gameData;

    if (!game) {
      router.push("/categories");
      return;
    }

    const updated = {
      ...game,
      used: {},
      seenQuestions: {},
      turnIndex: 0,
    };

    saveGame(updated);

    const cats = Array.isArray(updated.cats) ? updated.cats.join(",") : "";
    router.push(cats ? `/game?cats=${encodeURIComponent(cats)}` : "/game");
  }

  function playAgainResetScores() {
    const game = loadGame() || result?.gameData;

    if (!game) {
      router.push("/categories");
      return;
    }

    const updated = {
      ...game,
      used: {},
      seenQuestions: {},
      turnIndex: 0,
      teams: (game.teams || []).map((t: any) => ({
        ...t,
        score: 0,
      })),
    };

    saveGame(updated);

    const cats = Array.isArray(updated.cats) ? updated.cats.join(",") : "";
    router.push(cats ? `/game?cats=${encodeURIComponent(cats)}` : "/game");
  }

  if (!result || !winner) {
    return (
      <main className={styles.page}>
        <div className={styles.emptyCard}>
          <h1>ما فيه نتيجة محفوظة</h1>
          <p>ارجع وابدأ لعبة جديدة.</p>

          <Link href="/categories" className={styles.primaryBtn}>
            اختيار الفئات
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.confetti} />

      <section className={styles.stage}>
        <header className={styles.header}>
          <div className={styles.logoWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="مستوى" className={styles.logo} />
          </div>

          <div className={styles.sponsor}>
            <span>الراعي الرسمي</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ertishaf-logo.png" alt="ارتشاف" className={styles.sponsorLogo} />
          </div>
        </header>

        <div className={styles.hero}>
          <div className={styles.winnerSide}>
            <div className={styles.crown}>👑</div>

            <div className={styles.winnerAvatar}>
              <div className={styles.winnerEmoji}>😎</div>
              <div className={styles.speech}>مستووووى!</div>
            </div>

            <div className={styles.winnerCard}>
              <div className={styles.badge}>
                <Icon icon="mdi:trophy" width={28} height={28} />
                المركز الأول
              </div>

              <h1>{isTie ? "تعادل ناري!" : "الفائز"}</h1>

              <div className={styles.winnerName}>
                {renderTeamIcon(winner.icon, 36)}
                <span>
                  {isTie ? result.winners.map((w) => w.name).join(" و ") : winner.name}
                </span>
              </div>

              <div className={styles.scoreBig}>{winner.score} نقطة</div>
            </div>
          </div>

          <div className={styles.losersSide}>
            <div className={styles.titleBox}>
              <div className={styles.finishTitle}>انتهت اللعبة!</div>
              <div className={styles.finishSub}>
                مبروك للفايز… والباقين مستواهم يحتاج قهوة ارتشاف ☕
              </div>
            </div>

            <div className={styles.loserScene}>
              <div className={styles.loserBubble}>
                {second ? `${second.name}: المرة الجاية بنردها!` : "المرة الجاية أقوى!"}
              </div>

              <div className={styles.loserFaces}>
                {losers.length ? (
                  losers.map((team, i) => (
                    <div key={`${team.name}-${i}`} className={styles.loserFace}>
                      <div className={styles.sadEmoji}>{i % 2 === 0 ? "😢" : "😵‍💫"}</div>
                      <div className={styles.sadName}>{team.name}</div>
                    </div>
                  ))
                ) : (
                  <div className={styles.loserFace}>
                    <div className={styles.sadEmoji}>🤝</div>
                    <div className={styles.sadName}>كلهم فائزين</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <section className={styles.rankings}>
          <div className={styles.rankHeader}>الترتيب النهائي</div>

          <div className={styles.rankList}>
            {teams.map((team, i) => (
              <div
                key={`${team.name}-${i}`}
                className={`${styles.rankRow} ${i === 0 ? styles.rankFirst : ""}`}
              >
                <div className={styles.rankPlace}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                </div>

                <div className={styles.rankName}>
                  {renderTeamIcon(team.icon, 26)}
                  <span>{team.name}</span>
                </div>

                <div className={styles.rankScore}>{team.score} نقطة</div>
              </div>
            ))}
          </div>
        </section>

        <footer className={styles.actions}>
          <button type="button" className={styles.primaryBtn} onClick={playAgainKeepScores}>
            جولة جديدة بنفس النقاط
          </button>

          <button type="button" className={styles.secondaryBtn} onClick={playAgainResetScores}>
            جولة جديدة من الصفر
          </button>

          <Link href="/" className={styles.ghostBtn}>
            العودة للرئيسية
          </Link>
        </footer>
      </section>
    </main>
  );
}