import type { Metadata } from "next";
import SignInForm from "./SignInForm";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your UK Car Imports account.",
};

export default function SignInPage() {
  return (
    <main className={`${styles.page} wm-light`}>
      <h1 className={styles.heading}>Welcome back</h1>
      <p className={styles.subtext}>Sign in to see your saved cars, saved searches, and notifications.</p>
      <SignInForm />
    </main>
  );
}
