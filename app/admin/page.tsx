"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./admin.module.css";
import { useRouter } from "next/navigation";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  setDoc,
} from "firebase/firestore";

import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

type AdminTab = "categories" | "questions" | "users" | "marketing";

type Category = {
  id: string;
  name: string;
  imageUrl?: string;
  order?: number;
  createdAt?: any;
  updatedAt?: any;
};

type Question = {
  id: string;
  text: string;
  points: number;
  imageUrl?: string;
  answerText?: string;
  answerImageUrl?: string;
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
};

type PromoCode = {
  id: string;
  code: string;
  percentOff?: number;
  maxUses?: number;
  usedCount?: number;
  active?: boolean;
  createdAt?: any;
};

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase() || "";

export default function AdminPage() {
  const router = useRouter();

  // -----------------------------
  // ✅ Active Pack (يحدد وين نخزن الفئات/الأسئلة)
  // -----------------------------
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

  // -----------------------------
  // Auth guard (Admin only)
  // -----------------------------
  const [authLoading, setAuthLoading] = useState(true);
  const [me, setMe] = useState<User | null>(null);
  const [notAllowed, setNotAllowed] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setMe(u ?? null);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!me) {
      router.replace("/admin/login");
      return;
    }

    const email = (me.email || "").toLowerCase();
    if (!ADMIN_EMAIL || email !== ADMIN_EMAIL) {
      setNotAllowed(true);
    } else {
      setNotAllowed(false);
    }
  }, [authLoading, me, router]);

  async function handleLogout() {
    await signOut(auth);
    router.replace("/admin/login");
  }

  // -----------------------------
  // UI State
  // -----------------------------
  const [tab, setTab] = useState<AdminTab>("categories");

  // -----------------------------
  // Categories (CRUD) داخل packs/{activePackId}/categories
  // -----------------------------
  const [categories, setCategories] = useState<Category[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);

  const [catName, setCatName] = useState("");
  const [catOrder, setCatOrder] = useState<number>(1);
  const [catImageUrl, setCatImageUrl] = useState("");

  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const editingCat = useMemo(
    () => categories.find((c) => c.id === editingCatId) || null,
    [categories, editingCatId]
  );

  const [editCatName, setEditCatName] = useState("");
  const [editCatOrder, setEditCatOrder] = useState<number>(1);
  const [editCatImageUrl, setEditCatImageUrl] = useState("");

  useEffect(() => {
    setCatsLoading(true);

    const colRef = collection(db, "packs", activePackId, "categories");
    const qCats = query(colRef, orderBy("order", "asc"));

    const unsub = onSnapshot(
      qCats,
      (snap) => {
        const list: Category[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name ?? "",
            imageUrl: data.imageUrl ?? "",
            order: data.order ?? 0,
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });
        setCategories(list);
        setCatsLoading(false);

        // ضبط order الافتراضي للإضافة الجديدة
        const maxOrder = list.reduce((m, x) => Math.max(m, Number(x.order || 0)), 0);
        setCatOrder((prev) => (prev <= maxOrder ? maxOrder + 1 : prev));
      },
      (err) => {
        console.error(err);
        setCategories([]);
        setCatsLoading(false);
      }
    );

    return () => unsub();
  }, [activePackId]);

  async function addCategory() {
    const name = catName.trim();
    if (!name) return alert("اكتب اسم الفئة");

    await addDoc(collection(db, "packs", activePackId, "categories"), {
      name,
      order: Number(catOrder) || 1,
      imageUrl: catImageUrl.trim() || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setCatName("");
    setCatImageUrl("");
    setCatOrder((v) => v + 1);
  }

  function startEditCategory(c: Category) {
    setEditingCatId(c.id);
    setEditCatName(c.name);
    setEditCatOrder(Number(c.order || 1));
    setEditCatImageUrl(c.imageUrl || "");
  }

  async function saveEditCategory() {
    if (!editingCatId) return;

    const name = editCatName.trim();
    if (!name) return alert("اسم الفئة مطلوب");

    await updateDoc(doc(db, "packs", activePackId, "categories", editingCatId), {
      name,
      order: Number(editCatOrder) || 1,
      imageUrl: editCatImageUrl.trim() || "",
      updatedAt: serverTimestamp(),
    });

    setEditingCatId(null);
  }

  async function removeCategory(catId: string) {
    const ok = confirm(
      "حذف الفئة سيخفيها من واجهة اللاعب. (لن نحذف أسئلتها الفرعية تلقائياً الآن). هل أنت متأكد؟"
    );
    if (!ok) return;

    await deleteDoc(doc(db, "packs", activePackId, "categories", catId));
  }

  // -----------------------------
  // Questions (CRUD) تحت كل فئة
  // packs/{activePackId}/categories/{catId}/questions
  // -----------------------------
  const [selectedCatId, setSelectedCatId] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qsLoading, setQsLoading] = useState(false);

  // add question
  const [qText, setQText] = useState("");
  const [qPoints, setQPoints] = useState<number>(100);
  const [qImageUrl, setQImageUrl] = useState("");
  const [aText, setAText] = useState("");
  const [aImageUrl, setAImageUrl] = useState("");

  // edit question
  const [editingQId, setEditingQId] = useState<string | null>(null);
  const editingQ = useMemo(
    () => questions.find((q) => q.id === editingQId) || null,
    [questions, editingQId]
  );

  const [editQText, setEditQText] = useState("");
  const [editQPoints, setEditQPoints] = useState<number>(100);
  const [editQImageUrl, setEditQImageUrl] = useState("");
  const [editAText, setEditAText] = useState("");
  const [editAImageUrl, setEditAImageUrl] = useState("");

  // auto select first category
  useEffect(() => {
    if (!selectedCatId && categories.length) {
      setSelectedCatId(categories[0].id);
    }
  }, [categories, selectedCatId]);

  // لو تغير الـ pack، نظف اختيار الفئة والأسئلة
  useEffect(() => {
    setSelectedCatId("");
    setQuestions([]);
    setEditingQId(null);
  }, [activePackId]);

  // live subscribe questions for selected category
  useEffect(() => {
    setQuestions([]);
    setEditingQId(null);

    if (!selectedCatId) return;

    setQsLoading(true);
    const colRef = collection(db, "packs", activePackId, "categories", selectedCatId, "questions");
    const qRef = query(colRef, orderBy("points", "desc"));

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list: Question[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            text: data.text ?? "",
            points: Number(data.points ?? 100),
            imageUrl: data.imageUrl ?? "",
            answerText: data.answerText ?? "",
            answerImageUrl: data.answerImageUrl ?? "",
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });
        setQuestions(list);
        setQsLoading(false);
      },
      (err) => {
        console.error(err);
        setQuestions([]);
        setQsLoading(false);
      }
    );

    return () => unsub();
  }, [activePackId, selectedCatId]);

  async function addQuestion() {
    if (!selectedCatId) return alert("اختر فئة أولًا");

    const text = qText.trim();
    const ans = aText.trim();

    if (!text) return alert("اكتب نص السؤال");
    if (!ans) return alert("اكتب الإجابة");

    await addDoc(collection(db, "packs", activePackId, "categories", selectedCatId, "questions"), {
      text,
      points: Number(qPoints) || 100,
      imageUrl: qImageUrl.trim() || "",
      answerText: ans,
      answerImageUrl: aImageUrl.trim() || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setQText("");
    setQPoints(100);
    setQImageUrl("");
    setAText("");
    setAImageUrl("");
  }

  function startEditQuestion(q: Question) {
    setEditingQId(q.id);
    setEditQText(q.text);
    setEditQPoints(q.points);
    setEditQImageUrl(q.imageUrl || "");
    setEditAText(q.answerText || "");
    setEditAImageUrl(q.answerImageUrl || "");
  }

  async function saveEditQuestion() {
    if (!selectedCatId || !editingQId) return;

    const text = editQText.trim();
    const ans = editAText.trim();

    if (!text) return alert("نص السؤال مطلوب");
    if (!ans) return alert("الإجابة مطلوبة");

    await updateDoc(
      doc(db, "packs", activePackId, "categories", selectedCatId, "questions", editingQId),
      {
        text,
        points: Number(editQPoints) || 100,
        imageUrl: editQImageUrl.trim() || "",
        answerText: ans,
        answerImageUrl: editAImageUrl.trim() || "",
        updatedAt: serverTimestamp(),
      }
    );

    setEditingQId(null);
  }

  async function removeQuestion(qId: string) {
    if (!selectedCatId) return;
    const ok = confirm("متأكد تبغى تحذف السؤال؟");
    if (!ok) return;

    await deleteDoc(doc(db, "packs", activePackId, "categories", selectedCatId, "questions", qId));
  }

  // -----------------------------
  // Users (list) (مثل ما هو)
  // -----------------------------
  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);

  useEffect(() => {
    const colRef = collection(db, "users");
    const qUsers = query(colRef, orderBy("createdAt", "desc"));

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
          };
        });
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

  // -----------------------------
  // Marketing (Promo Codes) (مثل ما هو)
  // -----------------------------
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [promoLoading, setPromoLoading] = useState(true);

  const [promoCode, setPromoCode] = useState("");
  const [promoPercent, setPromoPercent] = useState<number>(10);
  const [promoMaxUses, setPromoMaxUses] = useState<number>(100);

  useEffect(() => {
    const colRef = collection(db, "promoCodes");
    const qPromo = query(colRef, orderBy("createdAt", "desc"));

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
          };
        });
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

  async function createPromoCode() {
    const code = promoCode.trim().toUpperCase();
    if (!code) return alert("اكتب كود الخصم");

    // نخليه doc id = code لتفادي التكرار
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
  }

  async function togglePromoActive(p: PromoCode) {
    await updateDoc(doc(db, "promoCodes", p.id), {
      active: !p.active,
      updatedAt: serverTimestamp(),
    });
  }

  async function deletePromo(p: PromoCode) {
    const ok = confirm(`حذف كود ${p.code} ؟`);
    if (!ok) return;
    await deleteDoc(doc(db, "promoCodes", p.id));
  }

  // -----------------------------
  // Render helpers
  // -----------------------------
  if (authLoading) {
    return (
      <div className={styles.centerPage}>
        <div className={styles.loadingBox}>جاري التحقق من الدخول…</div>
      </div>
    );
  }

  if (notAllowed) {
    return (
      <div className={styles.centerPage}>
        <div className={styles.card}>
          <h2 className={styles.h2}>غير مصرح</h2>
          <p className={styles.muted}>
            هذا الحساب ليس أدمن. سجّل دخول بحساب الأدمن: <b>{ADMIN_EMAIL || "غير محدد"}</b>
          </p>
          <div className={styles.row}>
            <button className={styles.btn} onClick={handleLogout}>
              تسجيل خروج
            </button>
            <button className={styles.primaryBtn} onClick={() => router.replace("/admin/login")}>
              صفحة تسجيل الأدمن
            </button>
          </div>
        </div>
      </div>
    );
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
          <button
            className={`${styles.navItem} ${tab === "categories" ? styles.navActive : ""}`}
            onClick={() => setTab("categories")}
          >
            الفئات
          </button>
          <button
            className={`${styles.navItem} ${tab === "questions" ? styles.navActive : ""}`}
            onClick={() => setTab("questions")}
          >
            الأسئلة والإجابات
          </button>
          <button
            className={`${styles.navItem} ${tab === "users" ? styles.navActive : ""}`}
            onClick={() => setTab("users")}
          >
            المستخدمين
          </button>
          <button
            className={`${styles.navItem} ${tab === "marketing" ? styles.navActive : ""}`}
            onClick={() => setTab("marketing")}
          >
            التسويق
          </button>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.meLine}>
            <span className={styles.dot} />
            <span className={styles.meEmail}>{me?.email}</span>
          </div>
          <button className={styles.btn} onClick={handleLogout}>
            تسجيل خروج
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarTitle}>
            {tab === "categories" && "إدارة الفئات"}
            {tab === "questions" && "إدارة الأسئلة والإجابات"}
            {tab === "users" && "بيانات المستخدمين"}
            {tab === "marketing" && "التسويق وأكواد الخصم"}
          </div>

          <div className={styles.topbarActions}>
            <button className={styles.ghostBtn} onClick={() => router.push("/categories")}>
              فتح واجهة اللاعب
            </button>
          </div>
        </header>

        {/* CONTENT */}
        {tab === "categories" && (
          <section className={styles.content}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.h2}>إضافة فئة جديدة</h2>
                <div className={styles.muted}>
                  تُحفظ داخل: <b>packs/{activePackId}/categories</b> وتظهر مباشرة للاعب.
                </div>
              </div>

              <div className={styles.grid3}>
                <div className={styles.field}>
                  <label className={styles.label}>اسم الفئة</label>
                  <input className={styles.input} value={catName} onChange={(e) => setCatName(e.target.value)} />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>الترتيب</label>
                  <input
                    className={styles.input}
                    type="number"
                    value={catOrder}
                    onChange={(e) => setCatOrder(Number(e.target.value))}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>رابط صورة الفئة</label>
                  <input className={styles.input} value={catImageUrl} onChange={(e) => setCatImageUrl(e.target.value)} />
                </div>
              </div>

              {catImageUrl?.trim() ? (
                <div className={styles.previewRow}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={styles.previewImg} src={catImageUrl.trim()} alt="preview" />
                </div>
              ) : null}

              <div className={styles.row}>
                <button className={styles.primaryBtn} onClick={addCategory}>
                  إضافة الفئة
                </button>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.h2}>قائمة الفئات</h2>
                <div className={styles.muted}>تعديل/حذف بسرعة</div>
              </div>

              {catsLoading ? (
                <div className={styles.loadingLine}>جاري التحميل…</div>
              ) : categories.length === 0 ? (
                <div className={styles.empty}>لا توجد فئات بعد.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>الصورة</th>
                        <th>الاسم</th>
                        <th>الترتيب</th>
                        <th>إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((c) => (
                        <tr key={c.id}>
                          <td>
                            {c.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img className={styles.avatar} src={c.imageUrl} alt={c.name} />
                            ) : (
                              <div className={styles.avatarPlaceholder} />
                            )}
                          </td>
                          <td>{c.name}</td>
                          <td>{Number(c.order || 0)}</td>
                          <td>
                            <div className={styles.row}>
                              <button className={styles.btnSmall} onClick={() => startEditCategory(c)}>
                                تعديل
                              </button>
                              <button className={styles.dangerBtnSmall} onClick={() => removeCategory(c.id)}>
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

            {/* Edit Modal */}
            {editingCat && (
              <div className={styles.modalOverlay} onMouseDown={() => setEditingCatId(null)}>
                <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
                  <div className={styles.modalHeader}>
                    <div className={styles.h2}>تعديل الفئة</div>
                    <button className={styles.modalClose} onClick={() => setEditingCatId(null)}>
                      ×
                    </button>
                  </div>

                  <div className={styles.grid3}>
                    <div className={styles.field}>
                      <label className={styles.label}>الاسم</label>
                      <input className={styles.input} value={editCatName} onChange={(e) => setEditCatName(e.target.value)} />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>الترتيب</label>
                      <input
                        className={styles.input}
                        type="number"
                        value={editCatOrder}
                        onChange={(e) => setEditCatOrder(Number(e.target.value))}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>رابط الصورة</label>
                      <input
                        className={styles.input}
                        value={editCatImageUrl}
                        onChange={(e) => setEditCatImageUrl(e.target.value)}
                      />
                    </div>
                  </div>

                  {editCatImageUrl?.trim() ? (
                    <div className={styles.previewRow}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className={styles.previewImg} src={editCatImageUrl.trim()} alt="preview" />
                    </div>
                  ) : null}

                  <div className={styles.rowBetween}>
                    <button className={styles.btn} onClick={() => setEditingCatId(null)}>
                      إلغاء
                    </button>
                    <button className={styles.primaryBtn} onClick={saveEditCategory}>
                      حفظ التعديل
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "questions" && (
          <section className={styles.content}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.h2}>اختيار الفئة</h2>
                <div className={styles.muted}>حدد الفئة لإدارة أسئلتها وإجاباتها</div>
              </div>

              <div className={styles.row}>
                <select className={styles.input} value={selectedCatId} onChange={(e) => setSelectedCatId(e.target.value)}>
                  {categories.length === 0 ? (
                    <option value="">لا توجد فئات</option>
                  ) : (
                    categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.h2}>إضافة سؤال + إجابة</h2>
                <div className={styles.muted}>السؤال يحتوي نقاط + صورة (اختياري) + إجابة (نص/صورة)</div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>نص السؤال</label>
                <textarea className={styles.textarea} value={qText} onChange={(e) => setQText(e.target.value)} />
              </div>

              <div className={styles.grid3}>
                <div className={styles.field}>
                  <label className={styles.label}>النقاط</label>
                  <input className={styles.input} type="number" value={qPoints} onChange={(e) => setQPoints(Number(e.target.value))} />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>رابط صورة السؤال (اختياري)</label>
                  <input className={styles.input} value={qImageUrl} onChange={(e) => setQImageUrl(e.target.value)} />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>رابط صورة الإجابة (اختياري)</label>
                  <input className={styles.input} value={aImageUrl} onChange={(e) => setAImageUrl(e.target.value)} />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>الإجابة (نص)</label>
                <input className={styles.input} value={aText} onChange={(e) => setAText(e.target.value)} />
              </div>

              {(qImageUrl.trim() || aImageUrl.trim()) && (
                <div className={styles.previewGrid}>
                  {qImageUrl.trim() ? (
                    <div className={styles.previewBox}>
                      <div className={styles.previewTitle}>صورة السؤال</div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className={styles.previewImg} src={qImageUrl.trim()} alt="q" />
                    </div>
                  ) : null}
                  {aImageUrl.trim() ? (
                    <div className={styles.previewBox}>
                      <div className={styles.previewTitle}>صورة الإجابة</div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className={styles.previewImg} src={aImageUrl.trim()} alt="a" />
                    </div>
                  ) : null}
                </div>
              )}

              <div className={styles.row}>
                <button className={styles.primaryBtn} onClick={addQuestion} disabled={!selectedCatId}>
                  إضافة السؤال
                </button>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.h2}>أسئلة هذه الفئة</h2>
                <div className={styles.muted}>تعديل/حذف — ترتيب تلقائي حسب النقاط</div>
              </div>

              {qsLoading ? (
                <div className={styles.loadingLine}>جاري التحميل…</div>
              ) : questions.length === 0 ? (
                <div className={styles.empty}>لا توجد أسئلة في هذه الفئة.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>النقاط</th>
                        <th>السؤال</th>
                        <th>الإجابة</th>
                        <th>إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questions.map((q) => (
                        <tr key={q.id}>
                          <td>{q.points}</td>
                          <td className={styles.tdWide}>
                            <div className={styles.qCell}>
                              <div className={styles.qText}>{q.text}</div>
                              {q.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img className={styles.inlineImg} src={q.imageUrl} alt="q" />
                              ) : null}
                            </div>
                          </td>
                          <td className={styles.tdWide}>
                            <div className={styles.qCell}>
                              <div className={styles.qText}>{q.answerText}</div>
                              {q.answerImageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img className={styles.inlineImg} src={q.answerImageUrl} alt="a" />
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <div className={styles.row}>
                              <button className={styles.btnSmall} onClick={() => startEditQuestion(q)}>
                                تعديل
                              </button>
                              <button className={styles.dangerBtnSmall} onClick={() => removeQuestion(q.id)}>
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

            {/* Edit Question Modal */}
            {editingQ && (
              <div className={styles.modalOverlay} onMouseDown={() => setEditingQId(null)}>
                <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
                  <div className={styles.modalHeader}>
                    <div className={styles.h2}>تعديل السؤال</div>
                    <button className={styles.modalClose} onClick={() => setEditingQId(null)}>
                      ×
                    </button>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>نص السؤال</label>
                    <textarea className={styles.textarea} value={editQText} onChange={(e) => setEditQText(e.target.value)} />
                  </div>

                  <div className={styles.grid3}>
                    <div className={styles.field}>
                      <label className={styles.label}>النقاط</label>
                      <input
                        className={styles.input}
                        type="number"
                        value={editQPoints}
                        onChange={(e) => setEditQPoints(Number(e.target.value))}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>رابط صورة السؤال</label>
                      <input
                        className={styles.input}
                        value={editQImageUrl}
                        onChange={(e) => setEditQImageUrl(e.target.value)}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>رابط صورة الإجابة</label>
                      <input
                        className={styles.input}
                        value={editAImageUrl}
                        onChange={(e) => setEditAImageUrl(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>الإجابة (نص)</label>
                    <input className={styles.input} value={editAText} onChange={(e) => setEditAText(e.target.value)} />
                  </div>

                  {(editQImageUrl.trim() || editAImageUrl.trim()) && (
                    <div className={styles.previewGrid}>
                      {editQImageUrl.trim() ? (
                        <div className={styles.previewBox}>
                          <div className={styles.previewTitle}>صورة السؤال</div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img className={styles.previewImg} src={editQImageUrl.trim()} alt="q" />
                        </div>
                      ) : null}
                      {editAImageUrl.trim() ? (
                        <div className={styles.previewBox}>
                          <div className={styles.previewTitle}>صورة الإجابة</div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img className={styles.previewImg} src={editAImageUrl.trim()} alt="a" />
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div className={styles.rowBetween}>
                    <button className={styles.btn} onClick={() => setEditingQId(null)}>
                      إلغاء
                    </button>
                    <button className={styles.primaryBtn} onClick={saveEditQuestion}>
                      حفظ التعديل
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "users" && (
          <section className={styles.content}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.h2}>المستخدمين المسجلين</h2>
                <div className={styles.muted}>هذا يعرض محتوى collection: users</div>
              </div>

              {usersLoading ? (
                <div className={styles.loadingLine}>جاري التحميل…</div>
              ) : users.length === 0 ? (
                <div className={styles.empty}>
                  لا يوجد مستخدمين مخزنين بعد.
                  <div className={styles.muted} style={{ marginTop: 8 }}>
                    إذا تسجيل اللاعب لا يحفظ بياناته في Firestore، قلّي وأعطيك كود الحفظ مباشرة.
                  </div>
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>الصورة</th>
                        <th>الاسم</th>
                        <th>الإيميل</th>
                        <th>المزوّد</th>
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
                          <td>{u.provider || "—"}</td>
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

        {tab === "marketing" && (
          <section className={styles.content}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.h2}>إنشاء كود خصم</h2>
                <div className={styles.muted}>مجهز للمستقبل — بدون نظام دفع الآن</div>
              </div>

              <div className={styles.grid3}>
                <div className={styles.field}>
                  <label className={styles.label}>الكود</label>
                  <input
                    className={styles.input}
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="مثال: ASSEM10"
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>نسبة الخصم %</label>
                  <input
                    className={styles.input}
                    type="number"
                    value={promoPercent}
                    onChange={(e) => setPromoPercent(Number(e.target.value))}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>حد الاستخدام</label>
                  <input
                    className={styles.input}
                    type="number"
                    value={promoMaxUses}
                    onChange={(e) => setPromoMaxUses(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className={styles.row}>
                <button className={styles.primaryBtn} onClick={createPromoCode}>
                  إنشاء الكود
                </button>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.h2}>أكواد الخصم</h2>
                <div className={styles.muted}>تفعيل/تعطيل وحذف</div>
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
                              <button className={styles.btnSmall} onClick={() => togglePromoActive(p)}>
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
      </main>
    </div>
  );
}