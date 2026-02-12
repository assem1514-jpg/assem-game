// app/loading.tsx
import Image from "next/image";
import styles from "./loading.module.css";

export default function Loading() {
  return (
    <div className={styles.page}>
      <div className={styles.center}>
        <Image
          src="/logo.png"
          alt="logo"
          width={140}
          height={140}
          priority
        />

        <div className={styles.text}>جاري التحميل...</div>
      </div>
    </div>
  );
}