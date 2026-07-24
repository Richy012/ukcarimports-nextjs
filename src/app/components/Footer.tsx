import Link from "next/link";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.top}>
        <div className={styles.offices}>
          <h2>OUR OFFICES</h2>
          <div className={styles.box}>
            <img src="https://ukcarimports.ie/assets/images/icon-4.png" alt="" width={60} height={60} />
            <div>
              <h5>ADDRESS</h5>
              <p>51 Bracken Rd, Sandyford Business Park, Sandyford, Dublin, D18 CV48, Ireland</p>
            </div>
          </div>
          <div className={styles.box}>
            <img src="https://ukcarimports.ie/assets/images/icon-5.png" alt="" width={60} height={60} />
            <div>
              <h5>EMAIL</h5>
              <p>info@ukcarimports.ie</p>
            </div>
          </div>
        </div>
        <div className={styles.map}>
          <iframe
            style={{ border: 0 }}
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2385.907439518616!2d-6.218018634164293!3d53.27327807996377!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4867054677fba92f%3A0x23d83dd2dc00eb6e!2sUK%20Car%20Imports!5e0!3m2!1sen!2sin!4v1589012063630!5m2!1sen!2sin"
            width="100%"
            height="300"
            loading="lazy"
            title="UK Car Imports office location"
          />
        </div>
      </div>

      <div className={styles.bottom}>
        <nav className={styles.links}>
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
