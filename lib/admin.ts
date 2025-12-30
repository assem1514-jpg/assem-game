export const ADMIN_EMAILS = ["assem1514@gmail.com"].map((e) => e.toLowerCase());

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}