// app/admin/admin-guard.tsx
"use client";

import React from "react";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  // ✅ بدون تصريح داخل التطبيق: أي أحد يفتح صفحة /admin (من ناحية الواجهة)
  return <>{children}</>;
}