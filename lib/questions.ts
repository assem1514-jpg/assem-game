export type Question = {
  id: number;
  category: string;
  image: string;
  time: number; // بالثواني
};

export const questions: Question[] = [
  {
    id: 1,
    category: "general",
    image: "/questions/man.jpg",
    time: 10,
  },
];