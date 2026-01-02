// app/admin/layout.tsx
import AdminGuard from "./admin-guard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div style={{ minHeight: "100vh", background: "#f7f7fb" }}>{children}</div>
    </AdminGuard>
  );
}