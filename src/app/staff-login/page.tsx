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
    <main className={`${styles.page} wm-light`}>
      <h1 className={styles.heading}>Staff Access</h1>
      <StaffLoginForm />
    </main>
  );
}
