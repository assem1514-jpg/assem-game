"use client";

import React, { useEffect, useState } from "react";
import styles from "./admin.module.css";
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
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type Section = {
  id: string;
  name: string;
  order?: number;
  createdAt?: any;
  updatedAt?: any;
};

export default function SectionsTab({
  activePackId,
}: {
  activePackId: string;
}) {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // ===============================
  // 🔹 جلب التصنيفات
  // ===============================
  useEffect(() => {
    setLoading(true);

    const colRef = collection(db, "packs", activePackId, "sections");
    const qRef = query(colRef, orderBy("order", "asc"));

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list: Section[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name ?? "",
            order: data.order ?? 0,
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });

        setSections(list);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setSections([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [activePackId]);

  // ===============================
  // 🔹 إضافة تصنيف
  // ===============================
  async function addSection() {
    const name = newName.trim();
    if (!name) return alert("اكتب اسم التصنيف");

    const maxOrder =
      sections.length > 0
        ? Math.max(...sections.map((s) => Number(s.order || 0)))
        : 0;

    try {
      await addDoc(collection(db, "packs", activePackId, "sections"), {
        name,
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setNewName("");
    } catch (e) {
      console.error(e);
      alert("فشل إضافة التصنيف");
    }
  }

  // ===============================
  // 🔹 حفظ تعديل
  // ===============================
  async function saveEdit(id: string) {
    const name = editName.trim();
    if (!name) return alert("اكتب اسم التصنيف");

    try {
      await updateDoc(doc(db, "packs", activePackId, "sections", id), {
        name,
        updatedAt: serverTimestamp(),
      });

      setEditingId(null);
    } catch (e) {
      console.error(e);
      alert("فشل التعديل");
    }
  }

  // ===============================
  // 🔹 حذف تصنيف
  // ===============================
  async function removeSection(id: string) {
    const ok = confirm("حذف التصنيف؟");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "packs", activePackId, "sections", id));
    } catch (e) {
      console.error(e);
      alert("فشل الحذف");
    }
  }

  return (
    <section className={styles.content}>
      {/* إضافة */}
      <div className={styles.card}>
        <h2 className={styles.h2}>إضافة تصنيف جديد</h2>

        <div className={styles.row}>
          <input
            className={styles.input}
            placeholder="اسم التصنيف"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button className={styles.primaryBtn} onClick={addSection}>
            إضافة
          </button>
        </div>
      </div>

      {/* القائمة */}
      <div className={styles.card}>
        <h2 className={styles.h2}>التصنيفات الحالية</h2>

        {loading ? (
          <div className={styles.loadingLine}>جاري التحميل…</div>
        ) : sections.length === 0 ? (
          <div className={styles.empty}>لا يوجد تصنيفات بعد.</div>
        ) : (
          sections.map((s) => (
            <div key={s.id} className={styles.rowBetween} style={{ marginBottom: 10 }}>
              {editingId === s.id ? (
                <>
                  <input
                    className={styles.input}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <div className={styles.row}>
                    <button
                      className={styles.primaryBtn}
                      onClick={() => saveEdit(s.id)}
                    >
                      حفظ
                    </button>
                    <button
                      className={styles.btn}
                      onClick={() => setEditingId(null)}
                    >
                      إلغاء
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 800 }}>{s.name}</div>
                  <div className={styles.row}>
                    <button
                      className={styles.btnSmall}
                      onClick={() => {
                        setEditingId(s.id);
                        setEditName(s.name);
                      }}
                    >
                      تعديل
                    </button>
                    <button
                      className={styles.dangerBtnSmall}
                      onClick={() => removeSection(s.id)}
                    >
                      حذف
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}