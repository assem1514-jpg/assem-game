// app/admin/CategoriesTab.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./admin.module.css";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type Section = {
  id: string;
  name: string;
  order?: number;
  createdAt?: any;
  updatedAt?: any;
};

type Category = {
  id: string;
  name: string;
  imageUrl?: string;
  description?: string;
  sectionId?: string; // ✅ المهم
  createdAt?: any;
  updatedAt?: any;
};

export default function CategoriesTab({ activePackId }: { activePackId: string }) {
  // ================= SECTIONS (للاختيار فقط) =================
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(true);

  useEffect(() => {
    setSectionsLoading(true);
    const colRef = collection(db, "packs", activePackId, "sections");
    const qRef = query(colRef);

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list: Section[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name ?? "",
            order: Number(data.order ?? 0),
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });

        list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.name || "").localeCompare(b.name || "", "ar"));
        setSections(list);
        setSectionsLoading(false);
      },
      (err) => {
        console.error(err);
        setSections([]);
        setSectionsLoading(false);
      }
    );

    return () => unsub();
  }, [activePackId]);

  // ================= CATEGORIES (المسار الصحيح) =================
  const [categories, setCategories] = useState<Category[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);

  useEffect(() => {
    setCatsLoading(true);

    const colRef = collection(db, "packs", activePackId, "categories");
    const qRef = query(colRef);

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list: Category[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name ?? "",
            imageUrl: data.imageUrl ?? "",
            description: data.description ?? "",
            sectionId: data.sectionId ?? data.groupId ?? data.section ?? "",
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });

        // ترتيب لطيف
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

  // ================= ADD CATEGORY =================
  const [catSectionId, setCatSectionId] = useState("");
  const [catName, setCatName] = useState("");
  const [catImageUrl, setCatImageUrl] = useState("");
  const [catDesc, setCatDesc] = useState("");

  async function addCategory() {
    const name = catName.trim();
    if (!name) return alert("اكتب اسم الفئة");
    if (!catSectionId) return alert("اختر التصنيف");

    try {
      await addDoc(collection(db, "packs", activePackId, "categories"), {
        name,
        imageUrl: catImageUrl.trim() || "",
        description: catDesc.trim() || "",
        sectionId: catSectionId, // ✅ هنا الحل
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setCatName("");
      setCatImageUrl("");
      setCatDesc("");
      // خلك على نفس التصنيف المختار
      alert("تمت إضافة الفئة ✅");
    } catch (e) {
      console.error(e);
      alert("فشل إضافة الفئة");
    }
  }

  // ================= EDIT/DELETE CATEGORY =================
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingCat = useMemo(() => categories.find((c) => c.id === editingId) || null, [categories, editingId]);

  const [editSectionId, setEditSectionId] = useState("");
  const [editName, setEditName] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editDesc, setEditDesc] = useState("");

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setEditSectionId(cat.sectionId || "");
    setEditName(cat.name || "");
    setEditImageUrl(cat.imageUrl || "");
    setEditDesc(cat.description || "");
  }

  async function saveEdit() {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) return alert("اسم الفئة مطلوب");
    if (!editSectionId) return alert("اختر التصنيف");

    try {
      await updateDoc(doc(db, "packs", activePackId, "categories", editingId), {
        name,
        imageUrl: editImageUrl.trim() || "",
        description: editDesc.trim() || "",
        sectionId: editSectionId,
        updatedAt: serverTimestamp(),
      });
      setEditingId(null);
      alert("تم التعديل ✅");
    } catch (e) {
      console.error(e);
      alert("فشل التعديل");
    }
  }

  async function removeCategory(catId: string) {
    const ok = confirm("حذف الفئة؟");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "packs", activePackId, "categories", catId));
    } catch (e) {
      console.error(e);
      alert("فشل الحذف");
    }
  }

  // ================= GROUP VIEW =================
  const sectionsById = useMemo(() => {
    const map: Record<string, Section> = {};
    sections.forEach((s) => (map[s.id] = s));
    return map;
  }, [sections]);

  const grouped = useMemo(() => {
    const map: Record<string, Category[]> = {};
    categories.forEach((c) => {
      const key = c.sectionId || "__NO_SECTION__";
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return map;
  }, [categories]);

  return (
    <section className={styles.content}>
      {/* إضافة فئة */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.h2}>إضافة فئة</h2>
          <div className={styles.muted}>اختر التصنيف ثم اكتب بيانات الفئة</div>
        </div>

        <div className={styles.grid3}>
          <div className={styles.field}>
            <label className={styles.label}>التصنيف</label>
            <select className={styles.input} value={catSectionId} onChange={(e) => setCatSectionId(e.target.value)}>
              <option value="">{sectionsLoading ? "جاري تحميل التصنيفات..." : "اختر التصنيف"}</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>اسم الفئة</label>
            <input className={styles.input} value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="مثال: معلومات عامة" />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>رابط الصورة</label>
            <input className={styles.input} value={catImageUrl} onChange={(e) => setCatImageUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>شرح الفئة (يظهر عند علامة التعجب)</label>
          <textarea className={styles.textarea} value={catDesc} onChange={(e) => setCatDesc(e.target.value)} placeholder="اكتب شرح مختصر للفئة..." />
        </div>

        {catImageUrl.trim() ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.previewImg} src={catImageUrl.trim()} alt="preview" />
        ) : null}

        <div className={styles.row}>
          <button className={styles.primaryBtn} onClick={addCategory}>
            إضافة فئة
          </button>
        </div>
      </div>

      {/* عرض الفئات مجمعة */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.h2}>التصنيفات والفئات</h2>
          <div className={styles.muted}>تعديل/حذف الفئات تحت كل تصنيف</div>
        </div>

        {catsLoading ? (
          <div className={styles.loadingLine}>جاري التحميل…</div>
        ) : categories.length === 0 ? (
          <div className={styles.empty}>لا توجد فئات بعد.</div>
        ) : (
          <>
            {sections.map((section) => {
              const list = grouped[section.id] || [];
              if (list.length === 0) return null;

              return (
                <div key={section.id} style={{ marginBottom: 22 }}>
                  <h3 style={{ marginBottom: 10 }}>{section.name}</h3>

                  {list.map((cat) => (
                    <div key={cat.id} className={styles.rowBetween} style={{ gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        {cat.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cat.imageUrl} alt={cat.name} style={{ width: 42, height: 42, borderRadius: 10, objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: 42, height: 42, borderRadius: 10, background: "#e7e7e7" }} />
                        )}

                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.name}</div>
                          {cat.description ? (
                            <div className={styles.muted} style={{ fontSize: 12, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {cat.description}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className={styles.row}>
                        <button className={styles.btnSmall} onClick={() => startEdit(cat)}>
                          تعديل
                        </button>
                        <button className={styles.dangerBtnSmall} onClick={() => removeCategory(cat.id)}>
                          حذف
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* بدون تصنيف (لو فيه بيانات قديمة) */}
            {(grouped["__NO_SECTION__"] || []).length ? (
              <div style={{ marginTop: 18 }}>
                <h3 style={{ marginBottom: 10 }}>بدون تصنيف</h3>
                {(grouped["__NO_SECTION__"] || []).map((cat) => (
                  <div key={cat.id} className={styles.rowBetween} style={{ gap: 12 }}>
                    <div style={{ fontWeight: 800 }}>{cat.name}</div>
                    <div className={styles.row}>
                      <button className={styles.btnSmall} onClick={() => startEdit(cat)}>
                        تعديل
                      </button>
                      <button className={styles.dangerBtnSmall} onClick={() => removeCategory(cat.id)}>
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* مودال تعديل */}
      {editingCat && (
        <div className={styles.modalOverlay} onMouseDown={() => setEditingId(null)}>
          <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.h2}>تعديل الفئة</div>
              <button className={styles.modalClose} onClick={() => setEditingId(null)}>
                ×
              </button>
            </div>

            <div className={styles.grid3}>
              <div className={styles.field}>
                <label className={styles.label}>التصنيف</label>
                <select className={styles.input} value={editSectionId} onChange={(e) => setEditSectionId(e.target.value)}>
                  <option value="">اختر التصنيف</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>اسم الفئة</label>
                <input className={styles.input} value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>رابط الصورة</label>
                <input className={styles.input} value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>شرح الفئة</label>
              <textarea className={styles.textarea} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            </div>

            {editImageUrl.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.previewImg} src={editImageUrl.trim()} alt="preview" />
            ) : null}

            <div className={styles.rowBetween}>
              <button className={styles.btn} onClick={() => setEditingId(null)}>
                إلغاء
              </button>
              <button className={styles.primaryBtn} onClick={saveEdit}>
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}