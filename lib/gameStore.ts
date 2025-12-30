import { create } from "zustand";

type Question = {
  id: string;
  image: string;
  question: string;
};

type GameState = {
  questions: Question[];
  current: number;
  time: number;
  setQuestions: (q: Question[]) => void;
  next: () => void;
  reset: () => void;
};

export const useGameStore = create<GameState>((set) => ({
  questions: [],
  current: 0,
  time: 10,

  setQuestions: (q) => set({ questions: q, current: 0 }),
  next: () => set((s) => ({ current: s.current + 1 })),
  reset: () => set({ current: 0, questions: [] }),
}));