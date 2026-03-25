// app/admin/QuestionsTab.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

type Section = {
  id: string;
  name: string;
  order?: number;
};

type Category = {
  id: string;
  name: string;
  imageUrl?: string;
  videoUrl?: string;
  description?: string;
  sectionId?: string;
  createdAt?: any;
  updatedAt?: any;
};

type Question = {
  id: string;
  text: string;
  points: 200 | 400 | 600;
  imageUrl?: string;
  videoUrl?: string;
  answerText?: string;
  answerImageUrl?: string;
  answerVideoUrl?: string;
  answerFirstLetter?: string;
  hintLetter?: string;
  createdAt?: any;
  updatedAt?: any;
};

const POINTS: Array<200 | 400 | 600> = [200, 400, 600];

const CLOUDINARY_CLOUD_NAME = "driw9oyiu";
const CLOUDINARY_UPLOAD_PRESET = "mostawa_unsigned";

async function uploadImageToCloudinary(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "mostawa");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || "فشل رفع الصورة");
  }

  return String(data.secure_url || "");
}

export default function QuestionsTab({ activePackId }: { activePackId: string }) {
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);
  const [selectedCatId, setSelectedCatId] = useState<string>("");

  useEffect(() => {
    setSectionsLoading(true);
    setSections([]);
    setSelectedSectionId("");
    setCategories([]);
    setSelectedCatId("");

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
          };
        });

        list.sort(
          (a, b) =>
            (a.order ?? 0) - (b.order ?? 0) ||
            (a.name || "").localeCompare(b.name || "", "ar")
        );
        setSections(list);
        setSectionsLoading(false);

        if (list.length) setSelectedSectionId((prev) => prev || list[0].id);
      },
      () => {
        setSections([]);
        setSectionsLoading(false);
      }
    );

    return () => unsub();
  }, [activePackId]);

  useEffect(() => {
    setCatsLoading(true);
    setCategories([]);
    setSelectedCatId("");

    if (!selectedSectionId) {
      setCatsLoading(false);
      return;
    }

    const colRef = collection(db, "packs", activePackId, "categories");
    const qRef = query(colRef, where("sectionId", "==", selectedSectionId));

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list: Category[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name ?? "",
            imageUrl: data.imageUrl ?? "",
            videoUrl: data.videoUrl ?? "",
            description: data.description ?? "",
            sectionId: data.sectionId ?? data.groupId ?? data.section ?? "",
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });

        list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ar"));
        setCategories(list);
        setCatsLoading(false);

        if (list.length) setSelectedCatId((prev) => prev || list[0].id);
      },
      () => {
        setCategories([]);
        setCatsLoading(false);
      }
    );

    return () => unsub();
  }, [activePackId, selectedSectionId]);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [qsLoading, setQsLoading] = useState(false);

  const [qText, setQText] = useState("");
  const [qPoints, setQPoints] = useState<200 | 400 | 600>(200);
  const [qImageUrl, setQImageUrl] = useState("");
  const [qVideoUrl, setQVideoUrl] = useState("");
  const [aText, setAText] = useState("");
  const [aImageUrl, setAImageUrl] = useState("");
  const [aVideoUrl, setAVideoUrl] = useState("");
  const [answerFirstLetter, setAnswerFirstLetter] = useState("");

  const [editingQId, setEditingQId] = useState<string | null>(null);
  const editingQ = useMemo(
    () => questions.find((q) => q.id === editingQId) || null,
    [questions, editingQId]
  );

  const [editQText, setEditQText] = useState("");
  const [editQPoints, setEditQPoints] = useState<200 | 400 | 600>(200);
  const [editQImageUrl, setEditQImageUrl] = useState("");
  const [editQVideoUrl, setEditQVideoUrl] = useState("");
  const [editAText, setEditAText] = useState("");
  const [editAImageUrl, setEditAImageUrl] = useState("");
  const [editAVideoUrl, setEditAVideoUrl] = useState("");
  const [editAnswerFirstLetter, setEditAnswerFirstLetter] = useState("");

  const [uploadingAddQImage, setUploadingAddQImage] = useState(false);
  const [uploadingAddAImage, setUploadingAddAImage] = useState(false);
  const [uploadingEditQImage, setUploadingEditQImage] = useState(false);
  const [uploadingEditAImage, setUploadingEditAImage] = useState(false);

  const addQImageInputRef = useRef<HTMLInputElement | null>(null);
  const addAImageInputRef = useRef<HTMLInputElement | null>(null);
  const editQImageInputRef = useRef<HTMLInputElement | null>(null);
  const editAImageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setQuestions([]);
    setEditingQId(null);
  }, [activePackId, selectedSectionId, selectedCatId]);

  useEffect(() => {
    setQuestions([]);
    setEditingQId(null);

    if (!selectedCatId) return;

    setQsLoading(true);

    const colRef = collection(
      db,
      "packs",
      activePackId,
      "categories",
      selectedCatId,
      "questions"
    );

    const unsub = onSnapshot(
      query(colRef),
      (snap) => {
        const list: Question[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            text: data.text ?? "",
            points: Number(data.points ?? 200) as 200 | 400 | 600,
            imageUrl: data.imageUrl ?? "",
            videoUrl: data.videoUrl ?? "",
            answerText: data.answerText ?? "",
            answerImageUrl: data.answerImageUrl ?? "",
            answerVideoUrl: data.answerVideoUrl ?? "",
            answerFirstLetter:
              (data.answerFirstLetter ?? data.hintLetter ?? "")?.toString?.() ??
              "",
            hintLetter: data.hintLetter ?? "",
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });

        list.sort(
          (a, b) =>
            b.points - a.points ||
            String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
        );
        setQuestions(list);
        setQsLoading(false);
      },
      () => {
        setQuestions([]);
        setQsLoading(false);
      }
    );

    return () => unsub();
  }, [activePackId, selectedCatId]);

  async function handleUploadAddQuestionImage(file?: File | null) {
    if (!file) return;
    try {
      setUploadingAddQImage(true);
      const url = await uploadImageToCloudinary(file);
      setQImageUrl(url);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "فشل رفع صورة السؤال");
    } finally {
      setUploadingAddQImage(false);
      if (addQImageInputRef.current) addQImageInputRef.current.value = "";
    }
  }

  async function handleUploadAddAnswerImage(file?: File | null) {
    if (!file) return;
    try {
      setUploadingAddAImage(true);
      const url = await uploadImageToCloudinary(file);
      setAImageUrl(url);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "فشل رفع صورة الإجابة");
    } finally {
      setUploadingAddAImage(false);
      if (addAImageInputRef.current) addAImageInputRef.current.value = "";
    }
  }

  async function handleUploadEditQuestionImage(file?: File | null) {
    if (!file) return;
    try {
      setUploadingEditQImage(true);
      const url = await uploadImageToCloudinary(file);
      setEditQImageUrl(url);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "فشل رفع صورة السؤال");
    } finally {
      setUploadingEditQImage(false);
      if (editQImageInputRef.current) editQImageInputRef.current.value = "";
    }
  }

  async function handleUploadEditAnswerImage(file?: File | null) {
    if (!file) return;
    try {
      setUploadingEditAImage(true);
      const url = await uploadImageToCloudinary(file);
      setEditAImageUrl(url);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "فشل رفع صورة الإجابة");
    } finally {
      setUploadingEditAImage(false);
      if (editAImageInputRef.current) editAImageInputRef.current.value = "";
    }
  }

  async function addQuestion() {
    if (!selectedSectionId) return alert("اختر تصنيف أولًا");
    if (!selectedCatId) return alert("اختر فئة أولًا");

    const qt = qText.trim();
    const at = aText.trim();
    if (!qt) return alert("اكتب نص السؤال");
    if (!at) return alert("اكتب الإجابة");

    const fl = answerFirstLetter.trim();
    if (fl && fl.length > 1) return alert("أول حرف يكون حرف واحد فقط");

    await addDoc(
      collection(db, "packs", activePackId, "categories", selectedCatId, "questions"),
      {
        text: qt,
        points: qPoints,
        imageUrl: qImageUrl.trim() || "",
        videoUrl: qVideoUrl.trim() || "",
        answerText: at,
        answerImageUrl: aImageUrl.trim() || "",
        answerVideoUrl: aVideoUrl.trim() || "",
        answerFirstLetter: fl || "",
        hintLetter: fl || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );

    setQText("");
    setQPoints(200);
    setQImageUrl("");
    setQVideoUrl("");
    setAText("");
    setAImageUrl("");
    setAVideoUrl("");
    setAnswerFirstLetter("");
  }

  function startEditQuestion(q: Question) {
    setEditingQId(q.id);
    setEditQText(q.text || "");
    setEditQPoints((q.points as any) || 200);
    setEditQImageUrl(q.imageUrl || "");
    setEditQVideoUrl(q.videoUrl || "");
    setEditAText(q.answerText || "");
    setEditAImageUrl(q.answerImageUrl || "");
    setEditAVideoUrl(q.answerVideoUrl || "");
    setEditAnswerFirstLetter((q.answerFirstLetter || q.hintLetter || "") as string);
  }

  async function saveEditQuestion() {
    if (!editingQId || !selectedCatId) return;

    const qt = editQText.trim();
    const at = editAText.trim();
    if (!qt) return alert("نص السؤال مطلوب");
    if (!at) return alert("الإجابة مطلوبة");

    const fl = editAnswerFirstLetter.trim();
    if (fl && fl.length > 1) return alert("أول حرف يكون حرف واحد فقط");

    await updateDoc(
      doc(db, "packs", activePackId, "categories", selectedCatId, "questions", editingQId),
      {
        text: qt,
        points: editQPoints,
        imageUrl: editQImageUrl.trim() || "",
        videoUrl: editQVideoUrl.trim() || "",
        answerText: at,
        answerImageUrl: editAImageUrl.trim() || "",
        answerVideoUrl: editAVideoUrl.trim() || "",
        answerFirstLetter: fl || "",
        hintLetter: fl || "",
        updatedAt: serverTimestamp(),
      }
    );

    setEditingQId(null);
  }

  async function removeQuestion(qId: string) {
    if (!selectedCatId) return;
    if (!confirm("متأكد تبغى تحذف السؤال؟")) return;

    await deleteDoc(
      doc(db, "packs", activePackId, "categories", selectedCatId, "questions", qId)
    );
  }

  const addHasPreview =
    qImageUrl.trim() || qVideoUrl.trim() || aImageUrl.trim() || aVideoUrl.trim();

  const editHasPreview =
    editQImageUrl.trim() ||
    editQVideoUrl.trim() ||
    editAImageUrl.trim() ||
    editAVideoUrl.trim();

  return (
    <section className={styles.content}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.h2}>اختيار التصنيف والفئة</h2>
          <div className={styles.muted}>اختر التصنيف ثم الفئة لإدارة الأسئلة</div>
        </div>

        <div className={styles.grid3}>
          <div className={styles.field}>
            <label className={styles.label}>التصنيف</label>
            <select
              className={styles.input}
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              disabled={sectionsLoading}
            >
              {sectionsLoading ? (
                <option value="">جاري التحميل…</option>
              ) : sections.length === 0 ? (
                <option value="">لا توجد تصنيفات</option>
              ) : (
                sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className={styles.field} style={{ gridColumn: "span 2" }}>
            <label className={styles.label}>الفئة</label>
            <select
              className={styles.input}
              value={selectedCatId}
              onChange={(e) => setSelectedCatId(e.target.value)}
              disabled={catsLoading || !selectedSectionId}
            >
              {!selectedSectionId ? (
                <option value="">اختر تصنيف أولًا</option>
              ) : catsLoading ? (
                <option value="">جاري التحميل…</option>
              ) : categories.length === 0 ? (
                <option value="">لا توجد فئات داخل هذا التصنيف</option>
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
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.h2}>إضافة سؤال + إجابة</h2>
          <div className={styles.muted}>تقدر ترفع الصور من الجهاز مباشرة</div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>نص السؤال</label>
          <textarea
            className={styles.textarea}
            value={qText}
            onChange={(e) => setQText(e.target.value)}
          />
        </div>

        <div className={styles.grid3}>
          <div className={styles.field}>
            <label className={styles.label}>النقاط</label>
            <select
              className={styles.input}
              value={qPoints}
              onChange={(e) => setQPoints(Number(e.target.value) as any)}
            >
              {POINTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>صورة السؤال</label>

            <input
              ref={addQImageInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => void handleUploadAddQuestionImage(e.target.files?.[0] || null)}
            />

            <div className={styles.row}>
              <button
                type="button"
                className={styles.btnSmall}
                onClick={() => addQImageInputRef.current?.click()}
                disabled={uploadingAddQImage}
              >
                {uploadingAddQImage ? "جاري رفع الصورة..." : "رفع صورة السؤال"}
              </button>
            </div>

            <input
              className={styles.input}
              value={qImageUrl}
              onChange={(e) => setQImageUrl(e.target.value)}
              placeholder="سيظهر رابط الصورة هنا تلقائيًا"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>رابط فيديو السؤال</label>
            <input
              className={styles.input}
              value={qVideoUrl}
              onChange={(e) => setQVideoUrl(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.grid3}>
          <div className={styles.field}>
            <label className={styles.label}>الإجابة (نص)</label>
            <input
              className={styles.input}
              value={aText}
              onChange={(e) => setAText(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>صورة الإجابة</label>

            <input
              ref={addAImageInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => void handleUploadAddAnswerImage(e.target.files?.[0] || null)}
            />

            <div className={styles.row}>
              <button
                type="button"
                className={styles.btnSmall}
                onClick={() => addAImageInputRef.current?.click()}
                disabled={uploadingAddAImage}
              >
                {uploadingAddAImage ? "جاري رفع الصورة..." : "رفع صورة الإجابة"}
              </button>
            </div>

            <input
              className={styles.input}
              value={aImageUrl}
              onChange={(e) => setAImageUrl(e.target.value)}
              placeholder="سيظهر رابط الصورة هنا تلقائيًا"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>رابط فيديو الإجابة</label>
            <input
              className={styles.input}
              value={aVideoUrl}
              onChange={(e) => setAVideoUrl(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>أول حرف من الإجابة</label>
          <input
            className={styles.input}
            value={answerFirstLetter}
            onChange={(e) => setAnswerFirstLetter(e.target.value)}
            placeholder="مثال: أ"
          />
        </div>

        {addHasPreview ? (
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

            {qVideoUrl.trim() ? (
              <div className={styles.previewBox}>
                <div className={styles.previewTitle}>رابط فيديو السؤال</div>
                <div className={styles.muted} style={{ wordBreak: "break-all" }}>
                  {qVideoUrl.trim()}
                </div>
              </div>
            ) : null}

            {aVideoUrl.trim() ? (
              <div className={styles.previewBox}>
                <div className={styles.previewTitle}>رابط فيديو الإجابة</div>
                <div className={styles.muted} style={{ wordBreak: "break-all" }}>
                  {aVideoUrl.trim()}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={styles.row}>
          <button
            className={styles.primaryBtn}
            onClick={addQuestion}
            disabled={!selectedSectionId || !selectedCatId}
          >
            إضافة السؤال
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.h2}>قائمة الأسئلة</h2>
          <div className={styles.muted}>تعديل/حذف</div>
        </div>

        {qsLoading ? (
          <div className={styles.muted}>جاري التحميل…</div>
        ) : !selectedSectionId || !selectedCatId ? (
          <div className={styles.empty}>اختر تصنيف وفئة.</div>
        ) : questions.length === 0 ? (
          <div className={styles.empty}>لا توجد أسئلة.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>النقاط</th>
                  <th>السؤال</th>
                  <th>الإجابة</th>
                  <th>أول حرف</th>
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
                        {q.videoUrl ? (
                          <div
                            className={styles.muted}
                            style={{ marginTop: 6, wordBreak: "break-all" }}
                          >
                            {q.videoUrl}
                          </div>
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
                        {q.answerVideoUrl ? (
                          <div
                            className={styles.muted}
                            style={{ marginTop: 6, wordBreak: "break-all" }}
                          >
                            {q.answerVideoUrl}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      {(q.answerFirstLetter || q.hintLetter || "").trim()
                        ? q.answerFirstLetter || q.hintLetter
                        : "—"}
                    </td>
                    <td>
                      <div className={styles.row}>
                        <button className={styles.btnSmall} onClick={() => startEditQuestion(q)}>
                          تعديل
                        </button>
                        <button
                          className={styles.dangerBtnSmall}
                          onClick={() => removeQuestion(q.id)}
                        >
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
              <textarea
                className={styles.textarea}
                value={editQText}
                onChange={(e) => setEditQText(e.target.value)}
              />
            </div>

            <div className={styles.grid3}>
              <div className={styles.field}>
                <label className={styles.label}>النقاط</label>
                <select
                  className={styles.input}
                  value={editQPoints}
                  onChange={(e) => setEditQPoints(Number(e.target.value) as any)}
                >
                  {POINTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>صورة السؤال</label>

                <input
                  ref={editQImageInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) =>
                    void handleUploadEditQuestionImage(e.target.files?.[0] || null)
                  }
                />

                <div className={styles.row}>
                  <button
                    type="button"
                    className={styles.btnSmall}
                    onClick={() => editQImageInputRef.current?.click()}
                    disabled={uploadingEditQImage}
                  >
                    {uploadingEditQImage ? "جاري رفع الصورة..." : "رفع صورة السؤال"}
                  </button>
                </div>

                <input
                  className={styles.input}
                  value={editQImageUrl}
                  onChange={(e) => setEditQImageUrl(e.target.value)}
                  placeholder="سيظهر رابط الصورة هنا تلقائيًا"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>رابط فيديو السؤال</label>
                <input
                  className={styles.input}
                  value={editQVideoUrl}
                  onChange={(e) => setEditQVideoUrl(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.grid3}>
              <div className={styles.field}>
                <label className={styles.label}>الإجابة (نص)</label>
                <input
                  className={styles.input}
                  value={editAText}
                  onChange={(e) => setEditAText(e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>صورة الإجابة</label>

                <input
                  ref={editAImageInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) =>
                    void handleUploadEditAnswerImage(e.target.files?.[0] || null)
                  }
                />

                <div className={styles.row}>
                  <button
                    type="button"
                    className={styles.btnSmall}
                    onClick={() => editAImageInputRef.current?.click()}
                    disabled={uploadingEditAImage}
                  >
                    {uploadingEditAImage ? "جاري رفع الصورة..." : "رفع صورة الإجابة"}
                  </button>
                </div>

                <input
                  className={styles.input}
                  value={editAImageUrl}
                  onChange={(e) => setEditAImageUrl(e.target.value)}
                  placeholder="سيظهر رابط الصورة هنا تلقائيًا"
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>رابط فيديو الإجابة</label>
                <input
                  className={styles.input}
                  value={editAVideoUrl}
                  onChange={(e) => setEditAVideoUrl(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>أول حرف من الإجابة</label>
              <input
                className={styles.input}
                value={editAnswerFirstLetter}
                onChange={(e) => setEditAnswerFirstLetter(e.target.value)}
                placeholder="مثال: أ"
              />
            </div>

            {editHasPreview ? (
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

                {editQVideoUrl.trim() ? (
                  <div className={styles.previewBox}>
                    <div className={styles.previewTitle}>رابط فيديو السؤال</div>
                    <div className={styles.muted} style={{ wordBreak: "break-all" }}>
                      {editQVideoUrl.trim()}
                    </div>
                  </div>
                ) : null}

                {editAVideoUrl.trim() ? (
                  <div className={styles.previewBox}>
                    <div className={styles.previewTitle}>رابط فيديو الإجابة</div>
                    <div className={styles.muted} style={{ wordBreak: "break-all" }}>
                      {editAVideoUrl.trim()}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

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
  );
}