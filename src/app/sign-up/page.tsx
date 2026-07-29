import type { Metadata } from "next";
import SignUpForm from "./SignUpForm";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Register",
  description: "Create a UK Car Imports account to save cars, save searches, and get notified of new matches.",
};

export default function SignUpPage() {
  return (
    <main className={styles.page}>
      <img
        src="/assets/images/logo.png"
        alt="UK Car Imports"
        width={60}
        height={60}
        className={styles.logo}
      />
      <h1 className={styles.heading}>Create your account</h1>
      <p className={styles.subtext}>Save cars, save searches, and get emailed when a match appears.</p>
      <SignUpForm />
    </main>
  );
}
