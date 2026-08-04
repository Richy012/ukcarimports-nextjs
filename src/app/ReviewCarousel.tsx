"use client";

import { useEffect, useRef, useState } from "react";

export type Review = { name: string; quote: string; date?: string };

const HOLD_MS = 7000;
const FADE_MS = 500;

/**
 * Rotates review cards through the full list so every review gets the same
 * amount of airtime. Generic: the page supplies its own grid/card classes,
 * slot count and caption style, so the homepage (3 slots) and How It Works
 * (4 slots) share one implementation. Renders the first set at full opacity
 * on the server — no opacity:0 start state (the /how-it-works LCP lesson).
 * With `slots` or fewer reviews there is nothing to rotate and no timer runs.
 */
export default function ReviewCarousel({
  reviews,
  slots = 3,
  gridClass,
  cardClass,
  captionVariant = "posted",
}: {
  reviews: Review[];
  slots?: number;
  gridClass: string;
  cardClass: string;
  captionVariant?: "posted" | "google-review";
}) {
  const [start, setStart] = useState(0);
  const [visible, setVisible] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const rotates = reviews.length > slots;

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
        setStart((s) => (s + slots) % reviews.length);
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
  }, [rotates, reviews.length, slots]);

  const count = Math.min(slots, reviews.length);
  const shown = Array.from({ length: count }, (_, i) => reviews[(start + i) % reviews.length]);

  return (
    <div
      ref={ref}
      className={gridClass}
      style={rotates ? { opacity: visible ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` } : undefined}
    >
      {shown.map((r, i) => (
        <figure key={`${start}-${i}`} className={cardClass}>
          <blockquote>&ldquo;{r.quote}&rdquo;</blockquote>
          <figcaption>
            {captionVariant === "posted" ? (
              <>
                &mdash; {r.name} <span>&middot; Posted on Google</span>
              </>
            ) : (
              <>&mdash; {r.name}, Google review</>
            )}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
