"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import styles from "./Footer.module.css";

const EMBED_SRC =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2385.907439518616!2d-6.218018634164293!3d53.27327807996377!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4867054677fba92f%3A0x23d83dd2dc00eb6e!2sUK%20Car%20Imports!5e0!3m2!1sen!2sin!4v1589012063630!5m2!1sen!2sin";

/**
 * Click-to-load map.
 *
 * The Google Maps embed pulls ~313KB across four scripts (places.js, main.js,
 * init_embed.js, util.js) and a large slice of main-thread time. `loading=lazy`
 * was not enough: on short pages the footer is inside the first viewport, so
 * the embed loaded on every visit and dominated the page. Measured 2026-08-03
 * on /how-it-works, where those four scripts plus GTM were the six largest
 * resources on the page.
 *
 * The map is a footer convenience, so it now mounts only when someone asks for
 * it. Anyone who just wants directions gets a plain link, which costs nothing.
 */
export default function FooterMap() {
  const [shown, setShown] = useState(false);

  if (shown) {
    return (
      <iframe
        style={{ border: 0 }}
        src={EMBED_SRC}
        width="100%"
        height="300"
        title="UK Car Imports office location"
      />
    );
  }

  return (
    <div className={styles.mapFacade}>
      <MapPin size={30} strokeWidth={1.5} color="#b60b0c" aria-hidden="true" />
      <p className={styles.mapFacadeText}>
        51 Bracken Rd, Sandyford Business Park, Sandyford, Dublin, D18&nbsp;CV48
      </p>
      <div className={styles.mapFacadeActions}>
        <button type="button" className={styles.mapFacadeBtn} onClick={() => setShown(true)}>
          Show map
        </button>
        <a
          className={styles.mapFacadeLink}
          href="https://www.google.com/maps/dir/?api=1&destination=UK+Car+Imports,+51+Bracken+Rd,+Sandyford+Business+Park,+Dublin+D18+CV48"
          target="_blank"
          rel="noreferrer"
        >
          Get directions
        </a>
      </div>
    </div>
  );
}
