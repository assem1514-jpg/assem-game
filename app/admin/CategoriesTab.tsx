"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./admin.module.css";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import type { Category } from "./page";

export default function CategoriesTab({
  activePackId,
  categories,
  catsLoading,
}: {
  activePackId: string;
  categories: Category[];
  catsLoading: boolean;
}) {

  const [catName, setCatName] = useState("");
  const [catGroup, setCatGroup] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catImageUrl, setCatImageUrl] = useState("");
  const [catVideoUrl, setCatVideoUrl] = useState("");

  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const editingCat = useMemo(
    () => categories.find((c) => c.id === editingCatId) || null,
    [categories, editingCatId]
  );

  const [editCatName, setEditCatName] = useState("");
  const [editCatGroup, setEditCatGroup] = useState("");
  const [editCatDesc, setEditCatDesc] = useState("");
  const [editCatImageUrl, setEditCatImageUrl] = useState("");
  const [editCatVideoUrl, setEditCatVideoUrl] = useState("");

  const [catQCount, setCatQCount] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    categories.forEach((c) => {
      const qCol = collection(db, "packs", activePackId, "categories", c.id, "questions");
      const unsub = onSnapshot(qCol, (snap) => {
        setCatQCount((p) => ({ ...p, [c.id]: snap.size }));
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach((u) => u());
  }, [activePackId, categories]);

  // 🔥 أهم تعديل هنا
  async function addCategory() {
    if (!catName.trim()) return alert("اكتب اسم الفئة");

    const maxOrder =
      categories.length > 0
        ? Math.max(...categories.map((c: any) => Number(c.order || 0)))
        : 0;

    await addDoc(collection(db, "packs", activePackId, "categories"), {
      name: catName.trim(),
      group: catGroup.trim(),
      description: catDesc.trim(),
      imageUrl: catImageUrl.trim(),
      videoUrl: catVideoUrl.trim(),

      // ✅ نضيف order تلقائي
      order: maxOrder + 1,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setCatName("");
    setCatGroup("");
    setCatDesc("");
    setCatImageUrl("");
    setCatVideoUrl("");
  }

  function startEditCategory(c: Category) {
    setEditingCatId(c.id);
    setEditCatName(c.name);
    setEditCatGroup(c.group || "");
    setEditCatDesc(c.description || "");
    setEditCatImageUrl(c.imageUrl || "");
    setEditCatVideoUrl(c.videoUrl || "");
  }

  async function saveEditCategory() {
    if (!editingCatId) return;
    if (!editCatName.trim()) return alert("اسم الفئة مطلوب");

    await updateDoc(doc(db, "packs", activePackId, "categories", editingCatId), {
      name: editCatName.trim(),
      group: editCatGroup.trim(),
      description: editCatDesc.trim(),
      imageUrl: editCatImageUrl.trim(),
      videoUrl: editCatVideoUrl.trim(),
      updatedAt: serverTimestamp(),
    });

    setEditingCatId(null);
  }

  async function removeCategory(catId: string) {
    if (!confirm("حذف الفئة؟")) return;
    await deleteDoc(doc(db, "packs", activePackId, "categories", catId));
  }

  return (
    <section className={styles.content}>
      <div className={styles.card}>
        <h2 className={styles.h2}>إضافة فئة</h2>

        <input className={styles.input} placeholder="اسم الفئة" value={catName} onChange={(e) => setCatName(e.target.value)} />
        <input className={styles.input} placeholder="التصنيف" value={catGroup} onChange={(e) => setCatGroup(e.target.value)} />
        <input className={styles.input} placeholder="رابط الصورة" value={catImageUrl} onChange={(e) => setCatImageUrl(e.target.value)} />
        <input className={styles.input} placeholder="رابط الفيديو" value={catVideoUrl} onChange={(e) => setCatVideoUrl(e.target.value)} />
        <textarea className={styles.textarea} placeholder="الشرح" value={catDesc} onChange={(e) => setCatDesc(e.target.value)} />

        {catImageUrl && (
          <img className={styles.previewImg} src={catImageUrl} alt="preview" />
        )}

        <button className={styles.primaryBtn} onClick={addCategory}>إضافة</button>
      </div>

      <div className={styles.card}>
        {catsLoading ? "تحميل..." : categories.map((c) => (
          <div key={c.id} className={styles.rowBetween}>
            <div>
              <b>{c.name}</b> ({catQCount[c.id] || 0})
            </div>
            <div>
              <button className={styles.btnSmall} onClick={() => startEditCategory(c)}>تعديل</button>
              <button className={styles.dangerBtnSmall} onClick={() => removeCategory(c.id)}>حذف</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}