"use client";

import { useEffect, useRef, useState } from "react";
import PhotoPlaceholder from "../components/PhotoPlaceholder";
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
  const ref = useRef<HTMLImageElement | null>(null);

  // Eager tiles can fail before hydration; onError alone misses that.
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return <PhotoPlaceholder />;
  }

  return (
    <img
      ref={ref}
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
