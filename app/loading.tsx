// app/loading.tsx

export default function Loading() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        width: "100%",
        background: "#000",
        display: "grid",
        placeItems: "center",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="مستوى"
        style={{
          width: "min(220px, 58vw)",
          height: "auto",
          objectFit: "contain",
        }}
      />
    </main>
  );
}