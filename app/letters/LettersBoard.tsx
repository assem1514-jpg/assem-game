"use client";

import { useMemo, useState } from "react";
import styles from "./letters-board.module.css";

type CellKind = "letter" | "red" | "green" | "black";
type Paint = "none" | "red" | "green" | "black";

type Cell = {
  id?: string;
  kind: CellKind;
  letter?: string;
};

type Props = {
  onPickLetter?: (letter: string) => void;
  disabled?: boolean;
};

type Step = 0 | 1 | 2 | 3;
type Winner = "green" | "red" | null;

export default function LettersBoard({ onPickLetter, disabled }: Props) {
  const cells = useMemo<Cell[]>(
    () => [
      { kind: "black" },
      { kind: "red" },
      { kind: "red" },
      { kind: "red" },
      { kind: "red" },
      { kind: "red" },
      { kind: "red" },

      { kind: "green" },
      { id: "hex1", kind: "letter", letter: "ب" },
      { id: "hex2", kind: "letter", letter: "ض" },
      { id: "hex3", kind: "letter", letter: "ص" },
      { id: "hex4", kind: "letter", letter: "ث" },
      { id: "hex5", kind: "letter", letter: "ق" },
      { kind: "green" },

      { kind: "green" },
      { id: "hex6", kind: "letter", letter: "ف" },
      { id: "hex7", kind: "letter", letter: "غ" },
      { id: "hex8", kind: "letter", letter: "ع" },
      { id: "hex9", kind: "letter", letter: "هـ" },
      { id: "hex10", kind: "letter", letter: "خ" },
      { kind: "green" },

      { kind: "green" },
      { id: "hex11", kind: "letter", letter: "ح" },
      { id: "hex12", kind: "letter", letter: "ج" },
      { id: "hex13", kind: "letter", letter: "م" },
      { id: "hex14", kind: "letter", letter: "ن" },
      { id: "hex15", kind: "letter", letter: "ت" },
      { kind: "green" },

      { kind: "green" },
      { id: "hex16", kind: "letter", letter: "أ" },
      { id: "hex17", kind: "letter", letter: "ل" },
      { id: "hex18", kind: "letter", letter: "ي" },
      { id: "hex19", kind: "letter", letter: "س" },
      { id: "hex20", kind: "letter", letter: "ش" },
      { kind: "green" },

      { kind: "green" },
      { id: "hex21", kind: "letter", letter: "ظ" },
      { id: "hex22", kind: "letter", letter: "ط" },
      { id: "hex23", kind: "letter", letter: "ذ" },
      { id: "hex24", kind: "letter", letter: "د" },
      { id: "hex25", kind: "letter", letter: "ز" },
      { kind: "green" },

      { kind: "black" },
      { kind: "red" },
      { kind: "red" },
      { kind: "red" },
      { kind: "red" },
      { kind: "red" },
      { kind: "red" },
    ],
    []
  );

  const COLS = 7;
  const ROWS = 7;

  const [selectedId, setSelectedId] = useState<string>("");
  const [step, setStep] = useState<Step>(0);

  const [paintById, setPaintById] = useState<Record<string, Paint>>({});
  const [clearedLetter, setClearedLetter] = useState<Record<string, boolean>>({});
  const [winner, setWinner] = useState<Winner>(null);

  const isLocked = disabled || winner !== null;

  function idxToRC(i: number) {
    return { r: Math.floor(i / COLS), c: i % COLS };
  }
  function rcToIdx(r: number, c: number) {
    return r * COLS + c;
  }

  function neighborsOf(idx: number): number[] {
    const { r, c } = idxToRC(idx);

    const res: number[] = [];
    const push = (rr: number, cc: number) => {
      if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) return;
      res.push(rcToIdx(rr, cc));
    };

    if (r % 2 === 0) {
      push(r, c - 1);
      push(r, c + 1);
      push(r - 1, c - 1);
      push(r - 1, c);
      push(r + 1, c - 1);
      push(r + 1, c);
    } else {
      push(r, c - 1);
      push(r, c + 1);
      push(r - 1, c);
      push(r - 1, c + 1);
      push(r + 1, c);
      push(r + 1, c + 1);
    }

    return res;
  }

  function checkWin(nextPaintById: Record<string, Paint>) {
    const isColor = (idx: number, color: "green" | "red") => {
      const cell = cells[idx];
      if (!cell) return false;
      if (cell.kind === color) return true;
      if (cell.kind === "letter" && cell.id) {
        const p = nextPaintById[cell.id] ?? "none";
        return p === color;
      }
      return false;
    };

    // ✅ فوز الأخضر: يسار -> يمين
    const greenStarts: number[] = [];
    const greenTargets = new Set<number>();
    for (let r = 1; r <= 5; r++) {
      const leftIdx = rcToIdx(r, 0);
      const rightIdx = rcToIdx(r, 6);
      if (cells[leftIdx]?.kind === "green") greenStarts.push(leftIdx);
      if (cells[rightIdx]?.kind === "green") greenTargets.add(rightIdx);
    }

    const bfs = (color: "green" | "red", starts: number[], targets: Set<number>) => {
      const q: number[] = [];
      const seen = new Set<number>();

      for (const s of starts) {
        if (!isColor(s, color)) continue;
        q.push(s);
        seen.add(s);
      }

      while (q.length) {
        const cur = q.shift()!;
        if (targets.has(cur)) return true;

        for (const nb of neighborsOf(cur)) {
          if (seen.has(nb)) continue;
          if (!isColor(nb, color)) continue;
          seen.add(nb);
          q.push(nb);
        }
      }
      return false;
    };

    const greenWon = bfs("green", greenStarts, greenTargets);

    // ✅ فوز الأحمر: أعلى -> أسفل
    const redStarts: number[] = [];
    const redTargets = new Set<number>();
    for (let c = 1; c <= 6; c++) {
      const topIdx = rcToIdx(0, c);
      const bottomIdx = rcToIdx(6, c);
      if (cells[topIdx]?.kind === "red") redStarts.push(topIdx);
      if (cells[bottomIdx]?.kind === "red") redTargets.add(bottomIdx);
    }

    const redWon = bfs("red", redStarts, redTargets);

    if (greenWon) return "green" as const;
    if (redWon) return "red" as const;
    return null;
  }

  function applyPaint(color: "green" | "red") {
    if (isLocked) return;
    if (!selectedId) return;

    setPaintById((prev) => {
      // ✅ أهم تعديل: تثبيت النوع عشان ما يصير string
      const next: Record<string, Paint> = { ...prev, [selectedId]: color };
      const w = checkWin(next);
      if (w) setWinner(w);
      return next;
    });

    setClearedLetter((m) => ({ ...m, [selectedId]: true }));
    setStep(2);
  }

  function resetSelected() {
    if (isLocked) return;
    if (!selectedId) return;

    setPaintById((prev) => {
      // ✅ أهم تعديل هنا بعد: "none" يتثبت كـ Paint
      const next: Record<string, Paint> = { ...prev, [selectedId]: "none" };
      return next;
    });

    setClearedLetter((m) => ({ ...m, [selectedId]: false }));
    setStep(2);
  }

  function resetAll() {
    setSelectedId("");
    setStep(0);
    setPaintById({});
    setClearedLetter({});
    setWinner(null);
  }

  function onCellClick(cell: Cell) {
    if (isLocked) return;
    if (!cell.id || cell.kind !== "letter" || !cell.letter) return;

    if (selectedId !== cell.id) {
      setSelectedId(cell.id);
      setStep(1);
      return;
    }

    if (step === 0) {
      setStep(1);
      return;
    }

    if (step === 1) {
      onPickLetter?.(cell.letter);
      setStep(2);
      return;
    }

    if (step === 2) {
      setStep(3);
      return;
    }

    if (step === 3) {
      setStep(1);
    }
  }

  return (
    <div className={styles.stage}>
      <div className={styles.boardWrap}>
        <ul className={styles.grid}>
          {cells.map((cell, idx) => {
            const key = cell.id ?? `b-${idx}`;
            const paint: Paint = cell.id ? paintById[cell.id] ?? "none" : "none";

            const baseClass =
              cell.kind === "red"
                ? styles.colorRed
                : cell.kind === "green"
                ? styles.colorGreen
                : cell.kind === "black"
                ? styles.colorBlack
                : "";

            const paintedClass =
              paint === "red"
                ? styles.colorRed
                : paint === "green"
                ? styles.colorGreen
                : paint === "black"
                ? styles.colorBlack
                : "";

            const isSelected = cell.id && cell.id === selectedId;
            const shouldBlink = isSelected && step === 1;

            const showLetter = cell.kind === "letter" && cell.id && !clearedLetter[cell.id];

            return (
              <li key={key} className={styles.cellLi}>
                <div
                  id={cell.id}
                  className={[
                    styles.hexagon,
                    baseClass,
                    paintedClass,
                    shouldBlink ? styles.blink : "",
                    cell.id && cell.kind === "letter" && !isLocked ? styles.clickable : "",
                  ].join(" ")}
                  onClick={() => onCellClick(cell)}
                  role={cell.id ? "button" : undefined}
                  aria-label={cell.id ? `hex ${cell.id}` : "border"}
                >
                  {showLetter ? <p className={styles.letter}>{cell.letter}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>

        {step === 3 && !winner ? (
          <div className={styles.controlsOverlay} role="dialog" aria-label="controls">
            <div className={styles.controlsCard}>
              <button type="button" className={styles.btn} onClick={() => applyPaint("green")}>
                أخضر
              </button>
              <button type="button" className={styles.btn} onClick={() => applyPaint("red")}>
                أحمر
              </button>
              <button type="button" className={styles.btn} onClick={resetSelected}>
                رجّع
              </button>
            </div>
          </div>
        ) : null}

        {winner ? (
          <div className={styles.winOverlay} role="dialog" aria-label="win">
            <div className={styles.winCard}>
              <div className={styles.confetti} aria-hidden="true" />
              <div className={styles.winTitle}>مبرووك!</div>
              <div className={styles.winSubtitle}>
                {winner === "green" ? "الأخضر وصل ✅" : "الأحمر وصل ✅"}
              </div>
              <button type="button" className={styles.winBtn} onClick={resetAll}>
                إعادة
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}