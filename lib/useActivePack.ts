"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * نقرأ الباك الحالي من: config/game.activePackId
 */
export function useActivePackId() {
  const [activePackId, setActivePackIdState] = useState<string>("");

  useEffect(() => {
    const ref = doc(db, "config", "game");
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data() as any;
      if (data?.activePackId) setActivePackIdState(String(data.activePackId));
    });
    return () => unsub();
  }, []);

  return activePackId;
}

/** للأدمن: تعيين الباك الحالي */
export async function setActivePackId(packId: string) {
  const ref = doc(db, "config", "game");
  await setDoc(ref, { activePackId: packId }, { merge: true });
}