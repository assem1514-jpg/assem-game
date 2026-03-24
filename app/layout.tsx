// app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/authContext";
import OrientationGate from "./OrientationGate";

export const metadata: Metadata = {
  title: "مستوى",
  description: "لعبة مستوى",
};

// ✅ Next.js 16: لازم viewport يكون export لحاله (مو داخل metadata)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="appRoot">
        <AuthProvider>
          {/* ✅ يجبر اللعب أفقي: لو الجوال عمودي يطلع تنبيه */}
          <OrientationGate>{children}</OrientationGate>
        </AuthProvider>
      </body>
    </html>
  );
}