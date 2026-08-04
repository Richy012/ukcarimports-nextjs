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
          Developed in-house on our <strong>Arklight</strong> AI platform
        </p>
      </div>
    </footer>
  );
}
