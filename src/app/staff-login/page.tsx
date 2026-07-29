import type { Metadata } from "next";
import StaffLoginForm from "./StaffLoginForm";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff Access",
  robots: { index: false, follow: false },
};

export default function StaffLoginPage() {
  return (
    <main className={styles.page}>
      <img
        src="/assets/images/logo.png"
        alt="UK Car Imports"
        width={60}
        height={60}
        className={styles.logo}
      />
      <h1 className={styles.heading}>Staff Access</h1>
      <StaffLoginForm />
    </main>
  );
}
