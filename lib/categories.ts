// lib/categories.ts
import { db } from "./firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

export type Category = {
  id: string;
  name: string;
  imageUrl?: string;
  createdAt?: any;
};

export function watchCategories(cb: (items: Category[]) => void) {
  const q = query(collection(db, "categories"), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }))
    );
  });
}

export async function addCategory(payload: { name: string; imageUrl?: string }) {
  await addDoc(collection(db, "categories"), {
    name: payload.name.trim(),
    imageUrl: payload.imageUrl?.trim() || "",
    createdAt: serverTimestamp(),
  });
}