"use client";

import { useState } from "react";
import styles from "./page.module.css";

export default function CarThumb({
  src,
  alt,
  priority,
}: {
  src: string;
  alt: string;
  priority: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={styles.cardImageFallback}>
        <span className={styles.cardImageFallbackIcon}>📷</span>
        <span>Image not available</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={280}
      height={210}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={styles.cardImage}
      onError={() => setFailed(true)}
    />
  );
}
