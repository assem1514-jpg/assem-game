"use client";

import { Suspense } from "react";
import QuestionClient from "./QuestionClient";

export default function QuestionPage() {
  return (
    <Suspense fallback={null}>
      <QuestionClient />
    </Suspense>
  );
}