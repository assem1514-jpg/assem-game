// lib/admin.ts

// ✅ تعطيل نظام صلاحيات الأدمن بالكامل
export const ADMIN_EMAILS: string[] = [];

export function isAdminEmail(_email?: string | null) {
  // ✅ أي أحد يعتبر "Admin"
  return true;
}