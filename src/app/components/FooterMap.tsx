"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import styles from "./Footer.module.css";

const EMBED_SRC =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2385.907439518616!2d-6.218018634164293!3d53.27327807996377!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4867054677fba92f%3A0x23d83dd2dc00eb6e!2sUK%20Car%20Imports!5e0!3m2!1sen!2sin!4v1589012063630!5m2!1sen!2sin";

/**
 * Map that appears on its own — no "Show map" button (owner call,
 * 2026-08-04), and no directions link: the business is online-only and a
 * directions CTA invited walk-in visits.
 *
 * The Google embed still costs ~313KB across four scripts (measured
 * 2026-08-03 on /how-it-works), so it is NOT rendered eagerly: the iframe
 * mounts only when the footer approaches the viewport. On long pages most
 * visitors never pay for it; on short pages the cost returns, which the
 * owner accepted in exchange for the map simply being there.
 *
 * The wrapper holds the iframe's exact height from the start so the
 * facade-to-map swap cannot shift the page (CLS 0 stays true).
 */
export default function FooterMap() {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!("IntersectionObserver" in window)) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ minHeight: 300 }}>
      {shown ? (
        <iframe
          style={{ border: 0 }}
          src={EMBED_SRC}
          width="100%"
          height="300"
          title="UK Car Imports office location"
        />
      ) : (
        <div className={styles.mapFacade}>
          <MapPin size={30} strokeWidth={1.5} color="#b60b0c" aria-hidden="true" />
          <p className={styles.mapFacadeText}>
            51 Bracken Rd, Sandyford Business Park, Sandyford, Dublin, D18&nbsp;CV48
          </p>
        </div>
      )}
    </div>
  );
}
