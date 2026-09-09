import styles from "../page.module.css";
import fstyles from "./Footer.module.css";

// Homepage band advertising Arklight Labs (the platform this site runs on).
// Owner asked to see it in place on staging, 8 Sep 2026. The beacon is the
// same mark and animation as the footer credit; UTM-tagged so GA4 on
// arklightlabs.com shows exactly what this band sends.
const AUDIT = "https://arklightlabs.com/audit?utm_source=ukcarimports.ie&utm_medium=band&utm_campaign=home";
const SITE = "https://arklightlabs.com/?utm_source=ukcarimports.ie&utm_medium=band&utm_campaign=home";

export default function ArklightBand() {
  return (
    <section className={styles.arklightBand} aria-label="Arklight Labs">
      <div className={styles.arklightBandInner}>
        <svg width="76" height="56" viewBox="0 0 38 24" fill="none" aria-hidden="true" className={`${fstyles.arklightMark} ${styles.arklightBandMark}`}>
          <path className={fstyles.beamR} d="M21.5 6.5 L35 3.5 L35 10.5 Z" fill="#e0a410" />
          <path className={fstyles.beamL} d="M16.5 6.5 L3 3.5 L3 10.5 Z" fill="#e0a410" />
          <circle className={fstyles.flare} cx="19" cy="7.5" r="5.5" fill="#f2c94c" />
          <g className={fstyles.burst} stroke="#e0a410" strokeWidth="1.2" strokeLinecap="round">
            <path d="M19 0.8 V-1.6 M12.6 3 L10.8 1.4 M25.4 3 L27.2 1.4 M11 7.5 H8.2 M27 7.5 H29.8 M13 12 L11.2 13.6 M25 12 L26.8 13.6" />
          </g>
          <path d="M16.5 21 L17.5 9 H20.5 L21.5 21 Z" stroke="#f4f8fc" strokeWidth="1.3" fill="none" />
          <rect className={fstyles.lamp} x="17.4" y="5.9" width="3.2" height="3.2" rx="0.5" fill="#e0a410" />
          <path d="M19 4.3 V3.1" stroke="#f4f8fc" strokeWidth="1.2" />
          <path d="M16 21 H22" stroke="#f4f8fc" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <div className={styles.arklightBandText}>
          <p className={styles.arklightBandKicker}>Like this site? We built it.</p>
          <h2>Every item you stock, found on Google, on your own site.</h2>
          <p>
            This site puts 115,000 stock pages in Google, so a buyer searching for the exact car lands here and enquires
            directly, with no marketplace fee. Arklight Labs builds the same for any business that sells things: boats,
            plant, tractors, tiles, houses. Put your address in and see what is holding yours back, free, in a minute.
          </p>
        </div>
        <div className={styles.arklightBandActions}>
          <a href={AUDIT} className={styles.arklightBandCta} rel="noopener">
            Check my website free &rarr;
          </a>
          <a href={SITE} className={styles.arklightBandLink} rel="noopener">
            arklightlabs.com
          </a>
        </div>
      </div>
    </section>
  );
}
