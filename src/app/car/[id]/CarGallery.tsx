"use client";

import { useEffect, useState } from "react";
import PhotoPlaceholder from "../../components/PhotoPlaceholder";
import styles from "./page.module.css";

// How far a lightbox photo may be enlarged past its own pixel size. Above
// roughly this, our 480px-wide stock photos start to look soft.
const MAX_UPSCALE = 1.75;

interface CarImage {
  id: number;
  image: string;
}

const GRID_SIZE = 4;

export default function CarGallery({
  heroSrc,
  carName,
  photos,
}: {
  heroSrc: string;
  carName: string;
  photos: CarImage[];
}) {
  // Deliberately not deduped against heroSrc -- a string-equality lookup here
  // is one more thing that can silently drift out of sync (query params,
  // encoding, a photo genuinely reused as both featured + gallery image) and
  // produces a confusing index mismatch when it does. Index 0 is always the
  // hero, thumbnail i is always gallery index i+1: simple, deterministic, no
  // lookup. Worst case if the source data reuses the hero photo is one
  // repeated frame while paging through, which is a much smaller problem
  // than an inconsistent index.
  const gallery = [{ id: -1, image: heroSrc }, ...photos];
  const totalPages = Math.max(1, Math.ceil(photos.length / GRID_SIZE));

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [gridPage, setGridPage] = useState(0);
  const [heroFailed, setHeroFailed] = useState(false);
  const [failedThumbs, setFailedThumbs] = useState<Set<number>>(new Set());

  const gridStart = gridPage * GRID_SIZE;
  const currentThumbnails = photos.slice(gridStart, gridStart + GRID_SIZE);

  function changeGridPage(delta: number, e: React.MouseEvent) {
    e.stopPropagation();
    setGridPage((p) => Math.max(0, Math.min(totalPages - 1, p + delta)));
  }

  useEffect(() => {
    if (openIndex === null) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowRight") setOpenIndex((i) => (i === null ? i : (i + 1) % gallery.length));
      if (e.key === "ArrowLeft") setOpenIndex((i) => (i === null ? i : (i - 1 + gallery.length) % gallery.length));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openIndex, gallery.length]);

  return (
    <div className={styles.gallery}>
      {heroFailed ? (
        <PhotoPlaceholder />
      ) : (
        <img
          src={heroSrc}
          alt={carName}
          width={800}
          height={600}
          fetchPriority="high"
          decoding="async"
          className={styles.heroImage}
          onClick={() => setOpenIndex(0)}
          style={{ cursor: "pointer" }}
          onError={() => setHeroFailed(true)}
        />
      )}
      {currentThumbnails.length > 0 && (
        <div className={styles.photoGridWrap}>
          <div className={styles.photoGrid}>
            {currentThumbnails.map((img, i) => (
              <div
                key={img.id}
                className={styles.photoGridItem}
                onClick={() => setOpenIndex(gridStart + i + 1)}
                style={{ cursor: "pointer" }}
              >
                {failedThumbs.has(img.id) ? (
                  <PhotoPlaceholder compact />
                ) : (
                  <img
                    src={img.image}
                    alt=""
                    width={260}
                    height={140}
                    loading="lazy"
                    decoding="async"
                    className={styles.thumb}
                    onError={() => setFailedThumbs((s) => new Set(s).add(img.id))}
                  />
                )}
              </div>
            ))}
          </div>

          {gridPage > 0 && (
            <button
              type="button"
              className={`${styles.gridNav} ${styles.gridNavPrev}`}
              onClick={(e) => changeGridPage(-1, e)}
              aria-label="Previous photos"
            >
              &#8249;
            </button>
          )}
          {gridPage < totalPages - 1 && (
            <button
              type="button"
              className={`${styles.gridNav} ${styles.gridNavNext}`}
              onClick={(e) => changeGridPage(1, e)}
              aria-label="More photos"
            >
              &#8250;
            </button>
          )}

          <button
            type="button"
            className={styles.viewAllBadge}
            onClick={(e) => {
              e.stopPropagation();
              setOpenIndex(0);
            }}
          >
            &#9638; {gallery.length}
          </button>
        </div>
      )}

      {openIndex !== null && (
        <div
          className={styles.lightboxOverlay}
          onClick={() => setOpenIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${carName} photo ${openIndex + 1} of ${gallery.length}`}
        >
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={() => setOpenIndex(null)}
            aria-label="Close"
          >
            &times;
          </button>

          {gallery.length > 1 && (
            <button
              type="button"
              className={`${styles.lightboxNav} ${styles.lightboxNavPrev}`}
              onClick={(e) => {
                e.stopPropagation();
                setOpenIndex((i) => (i === null ? i : (i - 1 + gallery.length) % gallery.length));
              }}
              aria-label="Previous photo"
            >
              &#8249;
            </button>
          )}

          <div className={styles.lightboxImageWrap} onClick={(e) => e.stopPropagation()}>
            <img
              /* Fresh element per photo so the cap below is recomputed rather
                 than inherited from the previous image. */
              key={openIndex}
              src={gallery[openIndex].image}
              alt={`${carName} photo ${openIndex + 1} of ${gallery.length}`}
              className={styles.lightboxImage}
              onLoad={(e) => {
                // Stored photos are a mix of 800px and 480px wide, often within
                // one car. Stretching them to fill the frame made the small
                // ones visibly soft next to the large ones. Allow a little
                // enlargement so photos still fill a reasonable area, but never
                // enough to turn a 480px photo to mush.
                const el = e.currentTarget;
                if (!el.naturalWidth) return;
                el.style.maxWidth = `min(100%, ${Math.round(el.naturalWidth * MAX_UPSCALE)}px)`;
                el.style.maxHeight = `min(100%, ${Math.round(el.naturalHeight * MAX_UPSCALE)}px)`;
              }}
            />
          </div>

          {gallery.length > 1 && (
            <button
              type="button"
              className={`${styles.lightboxNav} ${styles.lightboxNavNext}`}
              onClick={(e) => {
                e.stopPropagation();
                setOpenIndex((i) => (i === null ? i : (i + 1) % gallery.length));
              }}
              aria-label="Next photo"
            >
              &#8250;
            </button>
          )}

          <div className={styles.lightboxCounter}>
            {openIndex + 1} / {gallery.length}
          </div>
        </div>
      )}
    </div>
  );
}
