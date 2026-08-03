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
      </div>
    </footer>
  );
}
