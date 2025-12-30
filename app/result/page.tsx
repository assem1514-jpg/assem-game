"use client";

import { useGameStore } from "@/lib/gameStore";

export default function ResultPage() {
  const { questions } = useGameStore();

  return (
    <div>
      <h1>انتهت اللعبة 🎉</h1>
      <p>عدد الأسئلة: {questions.length}</p>
    </div>
  );
}