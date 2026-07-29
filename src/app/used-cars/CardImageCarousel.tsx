"use client";

import { useState } from "react";
import CarThumb from "./CarThumb";
import styles from "./page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";
const MAX_DOTS = 5;

export default function CardImageCarousel({
  carId,
  alt,
  heroSrc,
  photoIds,
  photoCount,
  priority,
}: {
  carId: string;
  alt: string;
  heroSrc: string;
  photoIds: number[];
  photoCount: number;
  priority: boolean;
}) {
  const frameCount = photoIds.length + 1; // hero + available extra photos
  const [index, setIndex] = useState(0);

  const src = index === 0 ? heroSrc : `${API_BASE}/car-thumb/${carId}/${photoIds[index - 1]}`;

  function go(delta: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIndex((i) => (i + delta + frameCount) % frameCount);
  }

  if (frameCount <= 1) {
    return <CarThumb src={heroSrc} alt={alt} priority={priority} />;
  }

  return (
    <div className={styles.cardImageCarousel}>
      <CarThumb src={src} alt={alt} priority={priority} />

      <button
        type="button"
        className={`${styles.carouselArrow} ${styles.carouselArrowPrev}`}
        onClick={(e) => go(-1, e)}
        aria-label="Previous photo"
      >
        &#8249;
      </button>
      <button
        type="button"
        className={`${styles.carouselArrow} ${styles.carouselArrowNext}`}
        onClick={(e) => go(1, e)}
        aria-label="Next photo"
      >
        &#8250;
      </button>

      <div className={styles.carouselDots}>
        {Array.from({ length: Math.min(frameCount, MAX_DOTS) }).map((_, i) => (
          <span key={i} className={`${styles.carouselDot} ${i === index ? styles.carouselDotActive : ""}`} />
        ))}
      </div>

      <div className={styles.carouselCounter}>
        {index + 1} / {photoCount}
      </div>
    </div>
  );
}
