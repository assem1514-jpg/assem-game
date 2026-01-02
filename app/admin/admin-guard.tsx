// app/admin/admin-guard.tsx
"use client";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  // ✅ بدون تصريح نهائياً: أي أحد يدخل
  return <>{children}</>;
}