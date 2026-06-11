// app/AppSplash.tsx
"use client";

import { useEffect, useState } from "react";

export default function AppSplash() {
  const [show, setShow] = useState(true);
  const [hide, setHide] = useState(false);

  useEffect(() => {
    const startHideTimer = window.setTimeout(() => {
      setHide(true);
    }, 1200);

    const removeTimer = window.setTimeout(() => {
      setShow(false);
    }, 1650);

    return () => {
      window.clearTimeout(startHideTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "#0D3B66",
        display: "grid",
        placeItems: "center",
        opacity: hide ? 0 : 1,
        transition: "opacity 450ms ease",
        pointerEvents: "none",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="مستوى"
        style={{
          width: "min(240px, 62vw)",
          height: "auto",
          objectFit: "contain",
          transform: hide ? "scale(0.96)" : "scale(1)",
          transition: "transform 450ms ease",
        }}
      />
    </div>
  );
}