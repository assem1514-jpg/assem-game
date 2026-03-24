// app/OrientationGate.tsx
"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

// الصفحات اللي “نفرض عليها” الوضع الأفقي (كل صفحات اللعب)
// تقدر تزيد/تنقص لاحقًا
const LANDSCAPE_ONLY_PREFIXES = ["/game", "/letters"];

function isLandscapeOnlyPath(pathname: string) {
  return LANDSCAPE_ONLY_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export default function OrientationGate({ children }: { children: ReactNode }) {
  const [pathname, setPathname] = useState<string>("");

  useEffect(() => {
    setPathname(window.location.pathname || "");
  }, []);

  const shouldForce = useMemo(
    () => (pathname ? isLandscapeOnlyPath(pathname) : false),
    [pathname]
  );

  const [isLandscape, setIsLandscape] = useState(true);

  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth || 0;
      const h = window.innerHeight || 0;
      // Landscape إذا العرض أكبر من الارتفاع
      setIsLandscape(w >= h);
    };

    calc();
    window.addEventListener("resize", calc);
    window.addEventListener("orientationchange", calc);
    return () => {
      window.removeEventListener("resize", calc);
      window.removeEventListener("orientationchange", calc);
    };
  }, []);

  // ✅ لو الصفحة مو لعبة: ما نمنع شيء
  if (!shouldForce) return <>{children}</>;

  // ✅ لو Landscape: نعرض الصفحة
  if (isLandscape) return <>{children}</>;

  // ✅ لو Portrait: نعرض شاشة “مِل الجوال”
  return (
    <div className="rotateLock">
      <div className="rotateCard">
        <div className="rotateIcon">📱↩️</div>
        <div className="rotateTitle">مِل الجوال</div>
        <div className="rotateSub">اللعبة تشتغل بالوضع الأفقي فقط</div>
      </div>
    </div>
  );
}