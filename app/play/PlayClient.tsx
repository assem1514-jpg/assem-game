// app/play/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./play.module.css";

import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

type Question = {
  text: string;
  points: number;
  imageUrl?: string;
  answer?: string;
};

export default function PlayPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const catId = sp.get("cat") || "";
  const qid = sp.get("qid") || "";
  const points = Number(sp.get("points") || 100);

  const catsParam = sp.get("cats") || "";
  const teamsParam = sp.get("teams") || "";

  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState<Question | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  // مؤقت بالأرقام (يبدأ من 1)
  const [sec, setSec] = useState(1);

  useEffect(() => {
    setSec(1);
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [catId, qid]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!catId || !qid) {
        router.replace("/game?cats=" + encodeURIComponent(catsParam) + "&teams=" + encodeURIComponent(teamsParam));
        return;
      }

      setLoading(true);
      setShowAnswer(false);

      try {
        const ref = doc(db, "categories", catId, "questions", qid);
        const snap = await getDoc(ref);

        if (!mounted) return;

        if (!snap.exists()) {
          setQ(null);
        } else {
          const data = snap.data() as any;
          setQ({
            text: data.text ?? "",
            points: Number(data.points ?? points),
            imageUrl: data.imageUrl ?? "",
            answer: data.answer ?? "",
          });
        }
      } catch (e) {
        console.error(e);
        if (mounted) setQ(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [catId, qid, router]);

  const backToBoard = () => {
    router.push(`/game?cats=${encodeURIComponent(catsParam)}&teams=${encodeURIComponent(teamsParam)}`);
  };

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <button className={styles.backBtn} onClick={backToBoard} type="button">
          ←
        </button>

        <div className={styles.title}>السؤال</div>

        <div className={styles.timer}>{sec}s</div>
      </header>

      {loading ? (
        <div className={styles.loading}>جاري التحميل…</div>
      ) : !q ? (
        <div className={styles.empty}>السؤال غير موجود</div>
      ) : (
        <div className={styles.content}>
          {/* الصورة كبيرة */}
          {q.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.bigImage} src={q.imageUrl} alt="question" />
          ) : null}

          {/* السؤال فوق */}
          <div className={styles.questionText}>{q.text}</div>

          <div className={styles.actions}>
            <button className={styles.yellowBtn} onClick={() => setShowAnswer(true)} type="button">
              إظهار الإجابة
            </button>

            <button className={styles.grayBtn} onClick={backToBoard} type="button">
              رجوع للشبكة
            </button>
          </div>

          {showAnswer ? (
            <div className={styles.answerBox}>
              <div className={styles.answerLabel}>الإجابة الصحيحة:</div>
              <div className={styles.answerText}>{q.answer || "لم يتم تحديد إجابة"}</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}