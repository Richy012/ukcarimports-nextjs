"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

export type Review = { name: string; quote: string };

const SLOTS = 3;
const HOLD_MS = 7000;
const FADE_MS = 500;

/**
 * Rotates the review cards through the full list so every review gets the
 * same amount of airtime. Renders the first set at full opacity on the
 * server -- no opacity:0 start state, which is what wrecked LCP on
 * /how-it-works. With three or fewer reviews there is nothing to rotate, so
 * no timer runs at all.
 */
export default function ReviewCarousel({ reviews }: { reviews: Review[] }) {
  const [start, setStart] = useState(0);
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const rotates = reviews.length > SLOTS;

  useEffect(() => {
    if (!rotates) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let onScreen = false;
    let hold: ReturnType<typeof setTimeout> | undefined;
    let fade: ReturnType<typeof setTimeout> | undefined;

    const stop = () => {
      if (hold) clearTimeout(hold);
      hold = undefined;
    };
    const schedule = () => {
      if (onScreen) hold = setTimeout(tick, HOLD_MS);
    };
    function tick() {
      setVisible(false);
      fade = setTimeout(() => {
        setStart((s) => (s + SLOTS) % reviews.length);
        setVisible(true);
        schedule();
      }, FADE_MS);
    }

    // Only rotate while the section is actually on screen.
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries[0].isIntersecting;
        stop();
        schedule();
      },
      { threshold: 0.2 },
    );
    const node = ref.current;
    if (node) io.observe(node);

    return () => {
      io.disconnect();
      stop();
      if (fade) clearTimeout(fade);
    };
  }, [rotates, reviews.length]);

  const count = Math.min(SLOTS, reviews.length);
  const shown = Array.from({ length: count }, (_, i) => reviews[(start + i) % reviews.length]);

  return (
    <div
      ref={ref}
      className={styles.reviewGrid}
      style={rotates ? { opacity: visible ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` } : undefined}
    >
      {shown.map((r, i) => (
        <figure key={`${start}-${i}`} className={styles.reviewCard}>
          <blockquote>&ldquo;{r.quote}&rdquo;</blockquote>
          <figcaption>
            &mdash; {r.name} <span>&middot; Posted on Google</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
