"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import googleReviews from "@/data/google-reviews.json";
import styles from "./page.module.css";

/**
 * One review beside the deposit decision.
 *
 * 122 Google reviews were doing no work at the bottom of two pages, while the
 * moment that actually needs trust -- a stranger about to send EUR 2,000 for a
 * car in another country -- had none (owner brief, 2026-08-04). These are the
 * five-star reviews that speak to the fear: it arrived, it was as described,
 * the timeline held.
 *
 * Rotates per page view (not on a timer) so it never distracts from the form,
 * and picks by car_id so the same car always shows the same review -- a
 * customer who returns twice doesn't see the story change.
 */
// Every five-star review with a written comment, straight from the Google
// Business Profile export (owner, 2026-08-04: "rotate through all the good
// ones"). Long entries are excluded here only because this slot sits beside
// the deposit button and must stay short -- they still appear on the
// homepage and How It Works rotators.
const TRUST_REVIEWS: { name: string; quote: string }[] = googleReviews.filter(
  (r) => r.quote.length >= 40 && r.quote.length <= 210,
);

export default function DepositTrust({ carId }: { carId: string }) {
  // Seeded by the car AND the day, so every review gets shown across the
  // fleet, the same car is consistent within a day, and a visitor returning
  // tomorrow sees a different voice rather than the same one forever.
  const [index, setIndex] = useState(0);
  useEffect(() => {
    let sum = 0;
    for (let i = 0; i < carId.length; i++) sum += carId.charCodeAt(i);
    const day = Math.floor(Date.now() / 86400000);
    setIndex((sum + day) % TRUST_REVIEWS.length);
  }, [carId]);

  const review = TRUST_REVIEWS[index];

  return (
    <div className={styles.depositTrust}>
      <div className={styles.depositTrustStars} aria-label="Five star review">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star key={i} size={13} strokeWidth={0} fill="#e0a410" aria-hidden="true" />
        ))}
      </div>
      <p className={styles.depositTrustQuote}>&ldquo;{review.quote}&rdquo;</p>
      <p className={styles.depositTrustName}>
        &mdash; {review.name} <span>&middot; Google review</span>
      </p>
    </div>
  );
}
