"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
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
const TRUST_REVIEWS: { name: string; quote: string }[] = [
  {
    name: "Ruairi O.",
    quote:
      "Just got a 2013 VW Scirocco through UKcarimports. Fast and easy service, 2 weeks from deposit placed to picking up car with the VRT done.",
  },
  {
    name: "Chris C.",
    quote: "Collected car yesterday. Fantastic service from beginning to end. Highly recommend this service.",
  },
  {
    name: "Paul D.",
    quote:
      "I can't speak highly enough of ukcarimports. Richard and his team were just amazing. The help and expertise was invaluable.",
  },
  {
    name: "Niamh K.",
    quote:
      "I recommend UK Car Imports for anyone considering buying a second hand car from the UK. The website is easy to use and the service is very efficient.",
  },
  {
    name: "Declan C.",
    quote:
      "Cannot fault this service and would certainly recommend. Very clear on what level of service that is offered, prompt replies to all of my queries.",
  },
  {
    name: "Aidan M.",
    quote: "Great service for importing car from UK. Richard was a pleasure to deal with and very smooth transaction.",
  },
];

export default function DepositTrust({ carId }: { carId: string }) {
  // Deterministic per car, so it is stable across visits and across SSR/CSR.
  const [index, setIndex] = useState(0);
  useEffect(() => {
    let sum = 0;
    for (let i = 0; i < carId.length; i++) sum += carId.charCodeAt(i);
    setIndex(sum % TRUST_REVIEWS.length);
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
