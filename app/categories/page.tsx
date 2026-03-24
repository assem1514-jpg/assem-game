"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  onSnapshot as onSnapDoc,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { Icon } from "@iconify/react";

type Section = { id: string; name: string; order?: number };
type Category = {
  id: string;
  name: string;
  imageUrl: string;
  description?: string;
  sectionId: string;
};

type Team = { name: string; icon: string };

const LS_KEY = "assem_game_v1";
const LS_PLAYED_KEY = "mstawaa_played_v1";

const TEAM_ICON_OPTIONS = [
  "twemoji:soccer-ball",
  "twemoji:basketball",
  "twemoji:volleyball",
  "twemoji:trophy",
  "twemoji:video-game",
  "twemoji:thinking-face",
  "twemoji:fire",
  "twemoji:star",
  "twemoji:crown",
  "twemoji:rocket",
];

function loadPlayedMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_PLAYED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveGame(data: any) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(data));
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

export default function CategoriesPage() {
  const router = useRouter();

  const [activePackId, setActivePackId] = useState<string>("main");
  useEffect(() => {
    const cfgRef = doc(db, "appConfig", "main");
    return onSnapDoc(cfgRef, (snap) => {
      const data = snap.data() as any;
      setActivePackId(data?.activePackId || "main");
    });
  }, []);

  const [sections, setSections] = useState<Section[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [modalText, setModalText] = useState<string | null>(null);

  const [teams, setTeams] = useState<Team[]>([
    { name: "", icon: TEAM_ICON_OPTIONS[0] },
    { name: "", icon: TEAM_ICON_OPTIONS[1] },
  ]);

  const [openIconPickerIndex, setOpenIconPickerIndex] = useState<number | null>(null);
  const [gamesLeft, setGamesLeft] = useState<Record<string, number>>({});
  const [playedMap, setPlayedMap] = useState<Record<string, number>>({});

  const [selectedModalOpen, setSelectedModalOpen] = useState(false);
  const [jumpModalOpen, setJumpModalOpen] = useState(false);

  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [webCodeModalOpen, setWebCodeModalOpen] = useState(false);
  const [generatedWebCode, setGeneratedWebCode] = useState("");
  const [generatedWebUrl, setGeneratedWebUrl] = useState("");

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const wasReadyRef = useRef(false);

  useEffect(() => {
    const qRef = query(
      collection(db, "packs", activePackId, "sections"),
      orderBy("order", "asc")
    );

    return onSnapshot(qRef, (snap) => {
      const arr: Section[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return { id: d.id, name: data.name ?? "", order: Number(data.order ?? 0) };
      });
      setSections(arr);
    });
  }, [activePackId]);

  useEffect(() => {
    const colRef = collection(db, "packs", activePackId, "categories");

    return onSnapshot(colRef, (snap) => {
      const arr: Category[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: (data.name ?? "").toString(),
          imageUrl: (data.imageUrl ?? "").toString(),
          description: (data.description ?? "").toString(),
          sectionId: (data.sectionId ?? "").toString(),
        };
      });

      arr.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
      setCategories(arr);
    });
  }, [activePackId]);

  useEffect(() => {
    setPlayedMap(loadPlayedMap());
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const map: Record<string, number> = {};

      for (const cat of categories) {
        try {
          const colRef = collection(
            db,
            "packs",
            activePackId,
            "categories",
            cat.id,
            "questions"
          );

          const agg = await getCountFromServer(colRef);
          const total = agg.data().count || 0;
          const games = Math.floor(total / 6);

          const played = Number(playedMap[cat.id] ?? 0);
          map[cat.id] = Math.max(0, games - played);
        } catch {
          map[cat.id] = 0;
        }
      }

      if (!cancelled) setGamesLeft(map);
    })();

    return () => {
      cancelled = true;
    };
  }, [categories, activePackId, playedMap]);

  function addTeam() {
    if (teams.length >= 4) return;
    setTeams((p) => [
      ...p,
      { name: "", icon: TEAM_ICON_OPTIONS[(p.length + 2) % TEAM_ICON_OPTIONS.length] },
    ]);
  }

  function removeTeam() {
    if (teams.length <= 2) return;
    setTeams((p) => p.slice(0, -1));
    setOpenIconPickerIndex((prev) => {
      if (prev === null) return null;
      return prev >= teams.length - 1 ? null : prev;
    });
  }

  function toggleCategory(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 6) return prev;
      return [...prev, id];
    });
  }

  function removeSelected(id: string) {
    setSelected((p) => p.filter((x) => x !== id));
  }

  const selectedMeta = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c]));
    return selected.map((id) => map.get(id)).filter(Boolean) as Category[];
  }, [selected, categories]);

  const canStart = selected.length === 6;

  useEffect(() => {
    if (canStart && !wasReadyRef.current) {
      setTeamModalOpen(true);
    }
    if (!canStart) {
      setTeamModalOpen(false);
    }
    wasReadyRef.current = canStart;
  }, [canStart]);

  function buildGamePayload() {
    const cleanedTeams = teams
      .map((t) => ({ name: (t.name || "").trim(), icon: t.icon }))
      .filter((t, i) => i < 4);

    return {
      startedAt: Date.now(),
      packId: activePackId,
      cats: selected,
      teams: cleanedTeams.map((t, idx) => ({
        name: t.name || `فريق ${idx + 1}`,
        score: 0,
        icon: t.icon,
      })),
      used: {},
    };
  }

  function startLocalGame() {
    const payload = buildGamePayload();
    saveGame(payload);
    setTeamModalOpen(false);
    router.push(`/game?cats=${encodeURIComponent(selected.join(","))}`);
  }

  async function startWebGame() {
    try {
      const payload = buildGamePayload();
      const sessionCode = await generateUniqueSessionCode();
      const origin = typeof window !== "undefined" ? window.location.origin : "";

      await addDoc(collection(db, "sessions"), {
        code: sessionCode,
        createdAt: serverTimestamp(),
        expiresAt: Date.now() + 4 * 60 * 60 * 1000,
        isActive: true,
        mode: "board",
        packId: activePackId,
        screenId: "main-screen",
        status: "active",
        gameData: payload,
      });

      setGeneratedWebCode(sessionCode);
      setGeneratedWebUrl(`${origin}/play`);
      setTeamModalOpen(false);
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

  function jumpToSection(sectionId: string) {
    const el = sectionRefs.current[sectionId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setJumpModalOpen(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.eyeWrap}>
        <button
          type="button"
          className={styles.floatingEye}
          onClick={() => setSelectedModalOpen(true)}
          title="عرض الفئات المختارة"
        >
          <span className={styles.floatingEyeCount}>{selected.length}/6</span>
          <Icon icon="mdi:eye-outline" width={22} height={22} />
        </button>
      </div>

      <div className={styles.wrapper}>
        <div className={styles.hero}>
          <Link href="/" className={styles.homeBtn}>
            <Icon icon="mdi:home" width={18} height={18} />
            العودة للرئيسية
          </Link>

          <div className={styles.heroTitle}>
            حيّاك في لعبة <span className={styles.heroName}>مستوى</span>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.logo} src="/logo.png" alt="logo" />
        </div>

        <div className={styles.jumpBar}>
          <div className={styles.jumpTitle}>الانتقال للتصنيفات</div>

          <button
            type="button"
            className={styles.jumpButton}
            onClick={() => setJumpModalOpen(true)}
          >
            <span>اختر تصنيف</span>
            <Icon icon="mdi:chevron-down" width={20} height={20} />
          </button>
        </div>

        {sections.map((section) => {
          const cats = categories.filter((c) => c.sectionId === section.id);
          if (!cats.length) return null;

          return (
            <div
              key={section.id}
              className={styles.block}
              ref={(el) => {
                sectionRefs.current[section.id] = el;
              }}
            >
              <div className={styles.sectionTitle}>{section.name}</div>

              <div className={styles.grid}>
                {cats.map((cat) => {
                  const isSel = selected.includes(cat.id);
                  const img = (cat.imageUrl || "").trim();

                  return (
                    <div
                      key={cat.id}
                      className={`${styles.card} ${isSel ? styles.selected : ""}`}
                      onClick={() => toggleCategory(cat.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className={styles.gamesLeft}>{gamesLeft[cat.id] ?? 0}</div>

                      <button
                        type="button"
                        className={styles.info}
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalText(cat.description?.trim() ? cat.description : "لا يوجد شرح");
                        }}
                        title="شرح الفئة"
                      >
                        !
                      </button>

                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} className={styles.image} alt={cat.name} />
                      ) : (
                        <div className={styles.image} />
                      )}

                      <div className={styles.cardFooter}>{cat.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {modalText && (
        <div className={styles.modal} onClick={() => setModalText(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            {modalText}
          </div>
        </div>
      )}

      {selectedModalOpen && (
        <div className={styles.modal} onClick={() => setSelectedModalOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>الفئات المختارة ({selected.length}/6)</div>

            <div className={styles.selectedModalChips}>
              {selectedMeta.length === 0 ? (
                <div className={styles.muted}>ما اخترت فئات إلى الآن</div>
              ) : (
                selectedMeta.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={styles.chip}
                    onClick={() => removeSelected(c.id)}
                    title="إزالة"
                  >
                    {c.name} <span className={styles.chipX}>×</span>
                  </button>
                ))
              )}
            </div>

            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setSelectedModalOpen(false)}
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {jumpModalOpen && (
        <div className={styles.modal} onClick={() => setJumpModalOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>الانتقال للتصنيفات</div>

            <div className={styles.jumpOptions}>
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={styles.jumpOption}
                  onClick={() => jumpToSection(section.id)}
                >
                  {section.name}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setJumpModalOpen(false)}
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {teamModalOpen && (
        <div className={styles.modal} onClick={() => setTeamModalOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.teamsTitle}>أسماء الفرق</div>

            <div className={styles.teamsGrid}>
              {teams.map((t, i) => (
                <div key={i} className={styles.teamRow}>
                  <div className={styles.teamIconWrap}>
                    <button
                      type="button"
                      className={styles.teamIconBtn}
                      onClick={() => setOpenIconPickerIndex((p) => (p === i ? null : i))}
                      title="اختر أيقونة الفريق"
                    >
                      <Icon icon={t.icon} width={22} height={22} />
                    </button>

                    {openIconPickerIndex === i && (
                      <div
                        className={styles.iconPopover}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <div className={styles.iconGrid}>
                          {TEAM_ICON_OPTIONS.map((ic) => (
                            <button
                              key={ic}
                              type="button"
                              className={styles.iconBtn}
                              onClick={() => {
                                setTeams((prev) =>
                                  prev.map((x, idx) => (idx === i ? { ...x, icon: ic } : x))
                                );
                                setOpenIconPickerIndex(null);
                              }}
                              title={ic}
                            >
                              <Icon icon={ic} width={22} height={22} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <input
                    className={styles.input}
                    placeholder={`اسم الفريق ${i + 1}`}
                    value={t.name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTeams((prev) => prev.map((x, idx) => (idx === i ? { ...x, name: v } : x)));
                    }}
                  />
                </div>
              ))}
            </div>

            <div className={styles.teamActions}>
              <button
                className={styles.addTeam}
                onClick={addTeam}
                type="button"
                disabled={teams.length >= 4}
              >
                زد العدد
              </button>

              <button
                className={styles.removeTeam}
                onClick={removeTeam}
                type="button"
                disabled={teams.length <= 2}
              >
                حذف فريق
              </button>
            </div>

            <div className={styles.teamStartActions}>
              <button
                className={styles.startBtn}
                onClick={startLocalGame}
                type="button"
              >
                ابدأ اللعبة
              </button>

              <button
                className={styles.webStartBtn}
                onClick={startWebGame}
                type="button"
              >
                ابدأ اللعبة بالموقع
              </button>
            </div>
          </div>
        </div>
      )}

      {webCodeModalOpen && (
        <div className={styles.modal} onClick={() => setWebCodeModalOpen(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.webModalTitle}>ابدأ اللعبة بالموقع</div>
            <div className={styles.webModalText}>
              هذا كود اللعبة. افتح موقع مستوى في الشاشة الثانية ثم أدخل الكود لعرض شبكة الأسئلة.
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

      {openIconPickerIndex !== null ? (
        <div className={styles.iconBackdrop} onClick={() => setOpenIconPickerIndex(null)} />
      ) : null}
    </div>
  );
}