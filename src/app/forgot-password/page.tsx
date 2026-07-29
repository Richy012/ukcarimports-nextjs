import type { Metadata } from "next";
import ForgotPasswordForm from "./ForgotPasswordForm";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your UK Car Imports account password.",
};

export default function ForgotPasswordPage() {
  return (
    <main className={styles.page}>
      <img
        src="/assets/images/logo.png"
        alt="UK Car Imports"
        width={60}
        height={60}
        className={styles.logo}
      />
      <h1 className={styles.heading}>Forgot your password?</h1>
      <p className={styles.subtext}>
        Enter the email address on your account and we&apos;ll send you a link to reset it.
      </p>
      <ForgotPasswordForm />
    </main>
  );
}
