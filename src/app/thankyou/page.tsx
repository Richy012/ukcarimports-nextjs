import type { Metadata } from "next";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Thank You",
  description: "Thank you - UK Car Imports",
};

export default function ThankYouPage() {
  return (
    <main className={`${styles.page} wm-light`}>
      <h1>Thank you!</h1>
      <img src="https://ukcarimports.ie/assets/images/thanks.jpg" alt="" className={styles.image} />
      <h3>Thank you very much. We shall be in touch shortly</h3>
    </main>
  );
}
