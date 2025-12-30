// app/providers.tsx
"use client";

import React from "react";
import AuthGate from "./auth-gate";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}