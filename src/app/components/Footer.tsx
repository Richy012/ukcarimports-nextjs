import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import FooterMap from "./FooterMap";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.top}>
        <div className={styles.offices}>
          <h2>OUR OFFICES</h2>
          <div className={styles.box}>
            <MapPin size={44} strokeWidth={1.25} color="#b60b0c" aria-hidden="true" />
            <div>
              <h3>ADDRESS</h3>
              <p>51 Bracken Rd, Sandyford Business Park, Sandyford, Dublin, D18 CV48, Ireland</p>
              <p className={styles.onlineOnly}>
                <span>ONLINE ONLY</span> No showroom — handover &amp; collection by appointment.
              </p>
            </div>
          </div>
          <div className={styles.box}>
            <Mail size={44} strokeWidth={1.25} color="#b60b0c" aria-hidden="true" />
            <div>
              <h3>EMAIL</h3>
              <p>info@ukcarimports.ie</p>
            </div>
          </div>
        </div>
        <div className={styles.map}>
          <FooterMap />
        </div>
      </div>

      <div className={styles.bottom}>
        <div className={styles.social}>
          <span className={styles.socialLabel}>Follow us</span>
          <a
            href="https://www.facebook.com/ukcarimports"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="UK Car Imports on Facebook"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
              <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
            </svg>
          </a>
          <a
            href="https://www.instagram.com/ukcarimports.ie"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="UK Car Imports on Instagram"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
              <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 5.68a4.16 4.16 0 1 0 0 8.32 4.16 4.16 0 0 0 0-8.32Zm0 6.86a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Zm5.3-7.02a.97.97 0 1 1-1.94 0 .97.97 0 0 1 1.94 0Z" />
            </svg>
          </a>
          <a
            href="https://x.com/ukcarimports_ie"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="UK Car Imports on X"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
              <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.66l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.03 4.12H5.06l12.02 15.65Z" />
            </svg>
          </a>
        </div>
        <nav className={styles.links}>
          <Link href="/bestseller-index">Bestseller Index</Link>
          <Link href="/terms-and-conditions">Terms &amp; Conditions</Link>
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <p>&copy; {new Date().getFullYear()} UK Car Imports. All rights reserved.</p>
        <p className={styles.arklight}>
          <svg
            width="38"
            height="28"
            viewBox="0 0 38 24"
            fill="none"
            aria-hidden="true"
            className={styles.arklightMark}
          >
            <path className={styles.beamR} d="M21.5 6.5 L35 3.5 L35 10.5 Z" fill="#e0a410" />
            <path className={styles.beamL} d="M16.5 6.5 L3 3.5 L3 10.5 Z" fill="#e0a410" />
            <circle className={styles.flare} cx="19" cy="7.5" r="5.5" fill="#f2c94c" />
            <g className={styles.burst} stroke="#e0a410" strokeWidth="1.2" strokeLinecap="round">
              <path d="M19 0.8 V-1.6 M12.6 3 L10.8 1.4 M25.4 3 L27.2 1.4 M11 7.5 H8.2 M27 7.5 H29.8 M13 12 L11.2 13.6 M25 12 L26.8 13.6" />
            </g>
            <path d="M16.5 21 L17.5 9 H20.5 L21.5 21 Z" stroke="#454443" strokeWidth="1.3" fill="none" />
            <rect className={styles.lamp} x="17.4" y="5.9" width="3.2" height="3.2" rx="0.5" fill="#e0a410" />
            <path d="M19 4.3 V3.1" stroke="#454443" strokeWidth="1.2" />
            <path d="M16 21 H22" stroke="#454443" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Developed in-house on our <strong>Arklight<sup className={styles.tm}>&trade;</sup></strong> AI platform
        </p>
      </div>
    </footer>
  );
}
