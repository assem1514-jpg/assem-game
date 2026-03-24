"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

function normalizeLetter(raw: string) {
  return (raw || "")
    .trim()
    .normalize("NFC")
    .replace(/\u0640/g, "")
    .replace("هـ", "ه");
}

type Item = {
  id: string;
  letter: string;
  question: string;
  answer: string;
  createdAt?: any;
  updatedAt?: any;
};

export default function LettersAdminPage() {
  const activePackId = "main";

  const [letter, setLetter] = useState("");
  const letterV = useMemo(() => normalizeLetter(letter), [letter]);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const [items, setItems] = useState<Item[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [editingId, setEditingId] = useState<string>("");

  useEffect(() => {
    if (!letterV) {
      setItems([]);
      setEditingId("");
      return;
    }

    setItemsLoading(true);

    const colRef = collection(
      db,
      "packs",
      activePackId,
      "lettersGame",
      letterV,
      "questions"
    );

    const qRef = query(colRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const list: Item[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            letter: data.letter ?? letterV,
            question: data.question ?? "",
            answer: data.answer ?? "",
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });

        setItems(list);
        setItemsLoading(false);
      },
      (err) => {
        console.error(err);
        setItems([]);
        setItemsLoading(false);
      }
    );

    return () => unsub();
  }, [letterV, activePackId]);

  function resetForm() {
    setQuestion("");
    setAnswer("");
    setEditingId("");
  }

  function startEdit(it: Item) {
    setEditingId(it.id);
    setQuestion(it.question);
    setAnswer(it.answer);
  }

  async function handleDelete(it: Item) {
    if (!letterV) return;

    const ok = confirm("حذف هذا السؤال؟");
    if (!ok) return;

    try {
      setLoading(true);

      await deleteDoc(
        doc(
          db,
          "packs",
          activePackId,
          "lettersGame",
          letterV,
          "questions",
          it.id
        )
      );

      if (editingId === it.id) resetForm();
    } catch (e) {
      console.error(e);
      alert("فشل الحذف");
    } finally {
      setLoading(false);
    }
  }

  async function ensureLetterDocExists(letterId: string) {
    await setDoc(
      doc(db, "packs", activePackId, "lettersGame", letterId),
      {
        letter: letterId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  async function handleSave() {
    const l = letterV;
    const qV = question.trim();
    const aV = answer.trim();

    if (!l || !qV || !aV) {
      alert("أكمل جميع الحقول");
      return;
    }

    const first = normalizeLetter(aV.slice(0, 2));
    if (!first.startsWith(l)) {
      alert("الإجابة يجب أن تبدأ بنفس الحرف المختار");
      return;
    }

    try {
      setLoading(true);

      await ensureLetterDocExists(l);

      const itemId = editingId || crypto.randomUUID();

      await setDoc(
        doc(
          db,
          "packs",
          activePackId,
          "lettersGame",
          l,
          "questions",
          itemId
        ),
        {
          letter: l,
          question: qV,
          answer: aV,
          updatedAt: serverTimestamp(),
          ...(editingId ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true }
      );

      alert(editingId ? "تم حفظ التعديل ✅" : "تمت الإضافة ✅");
      resetForm();
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "فشل الحفظ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <h2>إدارة لعبة الحروف</h2>

      <div style={{ display: "grid", gap: 12 }}>
        <select value={letter} onChange={(e) => setLetter(e.target.value)}>
          <option value="">اختر الحرف</option>
          {"ابتثجحخدذرزسشصضطظعغفقكلمنهوي".split("").map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        <textarea
          placeholder={letterV ? `اكتب سؤال لحرف (${letterV})` : "اختر حرف أولاً"}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={!letterV}
          style={{ minHeight: 100 }}
        />

        <input
          placeholder={letterV ? `اكتب إجابة تبدأ بـ (${letterV})` : "اختر حرف أولاً"}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={!letterV}
        />

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleSave} disabled={loading || !letterV}>
            {loading ? "جاري..." : editingId ? "حفظ التعديل" : "إضافة سؤال"}
          </button>

          {editingId && (
            <button onClick={resetForm} disabled={loading}>
              إلغاء التعديل
            </button>
          )}
        </div>

        <hr style={{ opacity: 0.3 }} />

        <div style={{ fontWeight: 900 }}>
          {letterV ? `أسئلة حرف (${letterV})` : "اختر حرف لعرض الأسئلة"}
        </div>

        {itemsLoading ? (
          <div>جاري التحميل…</div>
        ) : !letterV ? (
          <div style={{ opacity: 0.6 }}>—</div>
        ) : items.length === 0 ? (
          <div style={{ opacity: 0.6 }}>لا يوجد أسئلة لهذا الحرف بعد.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((it) => (
              <div
                key={it.id}
                style={{
                  border: "1px solid rgba(0,0,0,0.1)",
                  borderRadius: 12,
                  padding: 12,
                  background: "#ffffff88",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    س: {it.question}
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => startEdit(it)}
                      disabled={loading}
                    >
                      تعديل
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(it)}
                      disabled={loading}
                    >
                      حذف
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 6 }}>
                  <b>ج:</b> {it.answer}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}