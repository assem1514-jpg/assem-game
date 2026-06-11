// app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { AuthProvider } from "@/lib/authContext";
import OrientationGate from "./OrientationGate";
import AppSplash from "./AppSplash";

export const metadata: Metadata = {
  title: "مستوى",
  description: "لعبة مستوى",
};

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
        <AppSplash />

        <AuthProvider>
          <OrientationGate>{children}</OrientationGate>
        </AuthProvider>
      </body>
    </html>
  );
}