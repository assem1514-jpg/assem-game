// app/admin/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./admin.module.css";
import { useRouter } from "next/navigation";

import {
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import CategoriesTab from "./CategoriesTab";
import QuestionsTab from "./QuestionsTab";

type AdminTab = "categories" | "questions" | "users" | "marketing" | "letters";

export type Category = {
  id: string;
  name: string;
  imageUrl?: string;
  videoUrl?: string;
  description?: string;

  // ✅ تصنيف الفئة (عام/رياضة/موسيقى...)
  group?: string;

  createdAt?: any;
  updatedAt?: any;
};

type AppUser = {
  id: string; // uid
  name?: string;
  email?: string;
  photoURL?: string;
  provider?: string;
  createdAt?: any;
  lastLoginAt?: any;

  // ✅ رصيد اللعب
  credits?: number;
};

type PromoCode = {
  id: string;
  code: string;
  percentOff?: number;
  maxUses?: number;
  usedCount?: number;
  active?: boolean;
  createdAt?: any;
  updatedAt?: any;
};

// ✅ لعبة الحروف (مستقلة)
type LetterDoc = {
  id: string; // نفس الحرف
  letter: string;
  question: string;
  answer: string;
  createdAt?: any;
  updatedAt?: any;
};

const AR_LETTERS = [
  "ا",
  "ب",
  "ت",
  "ث",
  "ج",
  "ح",
  "خ",
  "د",
  "ذ",
  "ر",
  "ز",
  "س",
  "ش",
  "ص",
  "ض",
  "ط",
  "ظ",
  "ع",
  "غ",
  "ف",
  "ق",
  "ك",
  "ل",
  "م",
  "ن",
  "هـ",
  "و",
  "ي",
];

export default function AdminPage() {
  const router = useRouter();

  // ✅ Active Pack
  const [activePackId, setActivePackId] = useState<string>("main");
  useEffect(() => {
    const cfgRef = doc(db, "appConfig", "main");
    const unsub = onSnapshot(
      cfgRef,
      (snap) => {
        const data = snap.data() as any;
        setActivePackId(data?.activePackId || "main");
      },
      (err) => {
        console.error(err);
        setActivePackId("main");
      }
    );
    return () => unsub();
  }, []);

  // UI
  const [tab, setTab] = useState<AdminTab>("categories");

  // ✅ Categories subscription (مشترك بين التابين)
  const [categories, setCategories] = useState<Category[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);

  useEffect(() => {
    setCatsLoading(true);

    const colRef = collection(db, "packs", activePackId, "categories");
    const qCats = query(colRef);

    const unsub = onSnapshot(
      qCats,
      (snap) => {
        const list: Category[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name ?? "",
            imageUrl: data.imageUrl ?? "",
            videoUrl: data.videoUrl ?? "",
            description: data.description ?? "",
            group: data.group ?? data.categoryGroup ?? "",
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });

        // ترتيب بالاسم
        list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
        setCategories(list);
        setCatsLoading(false);
      },
      (err) => {
        console.error(err);
        setCategories([]);
        setCatsLoading(false);
      }
    );

    return () => unsub();
  }, [activePackId]);

  // -----------------------------
  // Users (list + charge credits)
  // -----------------------------
  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  // لكل مستخدم: قيمة الشحن اللي كاتبها الأدمن
  const [chargeMap, setChargeMap] = useState<Record<string, number>>({});

  useEffect(() => {
    const colRef = collection(db, "users");
    const qUsers = query(colRef);

    const unsub = onSnapshot(
      qUsers,
      (snap) => {
        const list: AppUser[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name ?? "",
            email: data.email ?? "",
            photoURL: data.photoURL ?? "",
            provider: data.provider ?? "",
            createdAt: data.createdAt ?? null,
            lastLoginAt: data.lastLoginAt ?? null,
            credits: Number(data.credits ?? data.playCredits ?? 0),
          };
        });

        list.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
        setUsers(list);
        setUsersLoading(false);
      },
      (err) => {
        console.error(err);
        setUsers([]);
        setUsersLoading(false);
      }
    );

    return () => unsub();
  }, []);

  async function chargeUser(uid: string) {
    const amount = Number(chargeMap[uid] ?? 0);
    if (!amount || amount <= 0) return alert("اكتب رقم شحن صحيح");

    try {
      await updateDoc(doc(db, "users", uid), {
        credits: increment(amount),
        updatedAt: serverTimestamp(),
      });
      // صفّر الحقل بعد الشحن
      setChargeMap((p) => ({ ...p, [uid]: 0 }));
      alert("تم شحن الرصيد ✅");
    } catch (e) {
      console.error(e);
      alert("فشل شحن الرصيد");
    }
  }

  // -----------------------------
  // Marketing (Promo Codes) + create/toggle/delete
  // -----------------------------
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [promoLoading, setPromoLoading] = useState(true);

  const [promoCode, setPromoCode] = useState("");
  const [promoPercent, setPromoPercent] = useState<number>(10);
  const [promoMaxUses, setPromoMaxUses] = useState<number>(100);

  useEffect(() => {
    const colRef = collection(db, "promoCodes");
    const qPromo = query(colRef);

    const unsub = onSnapshot(
      qPromo,
      (snap) => {
        const list: PromoCode[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            code: data.code ?? d.id,
            percentOff: Number(data.percentOff ?? 0),
            maxUses: Number(data.maxUses ?? 0),
            usedCount: Number(data.usedCount ?? 0),
            active: Boolean(data.active),
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });

        list.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
        setPromoCodes(list);
        setPromoLoading(false);
      },
      (err) => {
        console.error(err);
        setPromoCodes([]);
        setPromoLoading(false);
      }
    );

    return () => unsub();
  }, []);

  async function createPromo() {
    const code = promoCode.trim().toUpperCase();
    if (!code) return alert("اكتب كود الخصم");

    try {
      await setDoc(doc(db, "promoCodes", code), {
        code,
        percentOff: Number(promoPercent) || 0,
        maxUses: Number(promoMaxUses) || 0,
        usedCount: 0,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setPromoCode("");
      setPromoPercent(10);
      setPromoMaxUses(100);
      alert("تم إنشاء الكود ✅");
    } catch (e) {
      console.error(e);
      alert("فشل إنشاء الكود");
    }
  }

  async function togglePromo(p: PromoCode) {
    try {
      await updateDoc(doc(db, "promoCodes", p.id), {
        active: !p.active,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      alert("فشل تغيير حالة الكود");
    }
  }

  async function deletePromo(p: PromoCode) {
    const ok = confirm(`حذف كود ${p.code} ؟`);
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "promoCodes", p.id));
    } catch (e) {
      console.error(e);
      alert("فشل حذف الكود");
    }
  }

  // -----------------------------
  // Letters (حروف) - collection: lettersGame (docId=letter)
  // -----------------------------
  const [lettersLoading, setLettersLoading] = useState(true);
  const [lettersMap, setLettersMap] = useState<Record<string, LetterDoc>>({});

  const [selectedLetter, setSelectedLetter] = useState<string>("ا");
  const currentLetterDoc = useMemo(() => lettersMap[selectedLetter] || null, [lettersMap, selectedLetter]);

  const [letterQ, setLetterQ] = useState("");
  const [letterA, setLetterA] = useState("");

  useEffect(() => {
    const colRef = collection(db, "lettersGame");
    const qRef = query(colRef);

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const map: Record<string, LetterDoc> = {};
        snap.docs.forEach((d) => {
          const data = d.data() as any;
          map[d.id] = {
            id: d.id,
            letter: data.letter ?? d.id,
            question: data.question ?? "",
            answer: data.answer ?? "",
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });
        setLettersMap(map);
        setLettersLoading(false);
      },
      (err) => {
        console.error(err);
        setLettersMap({});
        setLettersLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // عبّي الحقول عند تغيير الحرف
  useEffect(() => {
    const d = lettersMap[selectedLetter];
    setLetterQ(d?.question ?? "");
    setLetterA(d?.answer ?? "");
  }, [selectedLetter, lettersMap]);

  async function saveLetter() {
    try {
      await setDoc(
        doc(db, "lettersGame", selectedLetter),
        {
          letter: selectedLetter,
          question: (letterQ || "").trim(),
          answer: (letterA || "").trim(),
          updatedAt: serverTimestamp(),
          createdAt: currentLetterDoc?.createdAt ?? serverTimestamp(),
        },
        { merge: true }
      );
      alert("تم حفظ الحرف ✅");
    } catch (e) {
      console.error(e);
      alert("فشل حفظ الحرف");
    }
  }

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandTitle}>لوحة الأدمن</div>
          <div className={styles.brandSub}>إدارة المحتوى واللاعبين</div>
          <div className={styles.brandSub} style={{ marginTop: 6, opacity: 0.8 }}>
            Pack الحالي: <b>{activePackId}</b>
          </div>
        </div>

        <nav className={styles.nav}>
          <button className={`${styles.navItem} ${tab === "categories" ? styles.navActive : ""}`} onClick={() => setTab("categories")}>
            الفئات
          </button>
          <button className={`${styles.navItem} ${tab === "questions" ? styles.navActive : ""}`} onClick={() => setTab("questions")}>
            الأسئلة والإجابات
          </button>
          <button className={`${styles.navItem} ${tab === "users" ? styles.navActive : ""}`} onClick={() => setTab("users")}>
            المستخدمين
          </button>
          <button className={`${styles.navItem} ${tab === "marketing" ? styles.navActive : ""}`} onClick={() => setTab("marketing")}>
            التسويق
          </button>
          <button className={`${styles.navItem} ${tab === "letters" ? styles.navActive : ""}`} onClick={() => setTab("letters")}>
            إدارة حروف
          </button>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.meLine}>
            <span className={styles.dot} />
            <span className={styles.meEmail}>ضيف</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarTitle}>
            {tab === "categories" && "إدارة الفئات"}
            {tab === "questions" && "إدارة الأسئلة والإجابات"}
            {tab === "users" && "بيانات المستخدمين + شحن الرصيد"}
            {tab === "marketing" && "التسويق وأكواد الخصم"}
            {tab === "letters" && "إدارة لعبة الحروف"}
          </div>

          <div className={styles.topbarActions}>
            <button className={styles.ghostBtn} onClick={() => router.push("/categories")}>
              فتح واجهة اللاعب
            </button>
          </div>
        </header>

        {/* CONTENT */}
        {tab === "categories" && (
          <CategoriesTab activePackId={activePackId} categories={categories} catsLoading={catsLoading} />
        )}

        {tab === "questions" && <QuestionsTab activePackId={activePackId} categories={categories} />}

        {/* USERS */}
        {tab === "users" && (
          <section className={styles.content}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.h2}>المستخدمين المسجلين</h2>
                <div className={styles.muted}>هنا تقدر تشوفهم وتشحن لهم رصيد لعب (credits)</div>
              </div>

              {usersLoading ? (
                <div className={styles.loadingLine}>جاري التحميل…</div>
              ) : users.length === 0 ? (
                <div className={styles.empty}>لا يوجد مستخدمين مخزنين بعد.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>الصورة</th>
                        <th>الاسم</th>
                        <th>الإيميل</th>
                        <th>الرصيد</th>
                        <th>شحن</th>
                        <th>آخر دخول</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td>
                            {u.photoURL ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img className={styles.avatar} src={u.photoURL} alt={u.name || "user"} />
                            ) : (
                              <div className={styles.avatarPlaceholder} />
                            )}
                          </td>
                          <td>{u.name || "—"}</td>
                          <td>{u.email || "—"}</td>
                          <td style={{ fontWeight: 900 }}>{u.credits ?? 0}</td>
                          <td>
                            <div className={styles.row}>
                              <input
                                className={styles.input}
                                style={{ maxWidth: 120 }}
                                type="number"
                                value={chargeMap[u.id] ?? 0}
                                onChange={(e) => setChargeMap((p) => ({ ...p, [u.id]: Number(e.target.value) }))}
                                placeholder="مثال: 10"
                              />
                              <button className={styles.btnSmall} onClick={() => chargeUser(u.id)}>
                                شحن
                              </button>
                            </div>
                          </td>
                          <td>{u.lastLoginAt?.toDate?.() ? u.lastLoginAt.toDate().toLocaleString() : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* MARKETING */}
        {tab === "marketing" && (
          <section className={styles.content}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.h2}>إنشاء كود خصم</h2>
                <div className={styles.muted}>أضف كود جديد + نسبة + حد الاستخدام</div>
              </div>

              <div className={styles.grid3}>
                <div className={styles.field}>
                  <label className={styles.label}>الكود</label>
                  <input className={styles.input} value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="ASSEM10" />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>نسبة الخصم %</label>
                  <input className={styles.input} type="number" value={promoPercent} onChange={(e) => setPromoPercent(Number(e.target.value))} />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>حد الاستخدام</label>
                  <input className={styles.input} type="number" value={promoMaxUses} onChange={(e) => setPromoMaxUses(Number(e.target.value))} />
                </div>
              </div>

              <div className={styles.row}>
                <button className={styles.primaryBtn} onClick={createPromo}>
                  إنشاء الكود
                </button>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.h2}>أكواد الخصم</h2>
                <div className={styles.muted}>تفعيل/تعطيل + حذف</div>
              </div>

              {promoLoading ? (
                <div className={styles.loadingLine}>جاري التحميل…</div>
              ) : promoCodes.length === 0 ? (
                <div className={styles.empty}>لا يوجد أكواد بعد.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>الكود</th>
                        <th>الخصم</th>
                        <th>الحد</th>
                        <th>المستخدم</th>
                        <th>الحالة</th>
                        <th>إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {promoCodes.map((p) => (
                        <tr key={p.id}>
                          <td className={styles.codeCell}>{p.code}</td>
                          <td>{p.percentOff || 0}%</td>
                          <td>{p.maxUses || 0}</td>
                          <td>{p.usedCount || 0}</td>
                          <td>
                            <span className={`${styles.badge} ${p.active ? styles.badgeOn : styles.badgeOff}`}>
                              {p.active ? "مفعل" : "متوقف"}
                            </span>
                          </td>
                          <td>
                            <div className={styles.row}>
                              <button className={styles.btnSmall} onClick={() => togglePromo(p)}>
                                {p.active ? "إيقاف" : "تفعيل"}
                              </button>
                              <button className={styles.dangerBtnSmall} onClick={() => deletePromo(p)}>
                                حذف
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* LETTERS */}
        {tab === "letters" && (
          <section className={styles.content}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.h2}>إدارة الحروف</h2>
                <div className={styles.muted}>
                  لعبة مستقلة: تختار حرف وتكتب سؤال/إجابة (بدون صور). التخزين في <b>lettersGame</b>
                </div>
              </div>

              {lettersLoading ? (
                <div className={styles.loadingLine}>جاري التحميل…</div>
              ) : (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>اختر الحرف</label>
                    <select className={styles.input} value={selectedLetter} onChange={(e) => setSelectedLetter(e.target.value)}>
                      {AR_LETTERS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>السؤال</label>
                    <textarea className={styles.textarea} value={letterQ} onChange={(e) => setLetterQ(e.target.value)} placeholder={`اكتب سؤال حرف (${selectedLetter})`} />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>الإجابة</label>
                    <textarea className={styles.textarea} value={letterA} onChange={(e) => setLetterA(e.target.value)} placeholder="اكتب الإجابة" />
                  </div>

                  <div className={styles.row}>
                    <button className={styles.primaryBtn} onClick={saveLetter}>
                      حفظ
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}