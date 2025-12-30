"use client";

import { Suspense } from "react";
import GameBoardClient from "./GameBoardClient";

export default function GamePage() {
  return (
    <Suspense fallback={null}>
      <GameBoardClient />
    </Suspense>
  );
}