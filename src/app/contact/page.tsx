import type { Metadata } from "next";
import ContactForm from "./ContactForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with UK Car Imports — our offices, email, and contact form.",
};

export default function ContactPage() {
  return (
    <main className={`${styles.page} wm-light`}>
      <h1>Contact Us</h1>
      <div className={styles.grid}>
        <div className={styles.offices}>
          <h2>OUR OFFICES</h2>
          <div className={styles.box}>
            <img src="https://ukcarimports.ie/assets/images/icon-4.png" alt="" width={50} height={50} />
            <div>
              <h5>ADDRESS</h5>
              <p>51 Bracken Rd, Sandyford Business Park, Sandyford, Dublin, D18 CV48, Ireland</p>
            </div>
          </div>
          <div className={styles.box}>
            <img src="https://ukcarimports.ie/assets/images/icon-5.png" alt="" width={50} height={50} />
            <div>
              <h5>EMAIL</h5>
              <p>info@ukcarimports.ie</p>
            </div>
          </div>
        </div>

        <ContactForm />
      </div>

      <iframe
        style={{ border: 0 }}
        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2385.907439518616!2d-6.218018634164293!3d53.27327807996377!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4867054677fba92f%3A0x23d83dd2dc00eb6e!2sUK%20Car%20Imports!5e0!3m2!1sen!2sin!4v1589012063630!5m2!1sen!2sin"
        width="100%"
        height="400"
        loading="lazy"
        title="UK Car Imports office location"
      />
    </main>
  );
}
