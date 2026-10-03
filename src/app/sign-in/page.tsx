import type { Metadata } from "next";
import SignInForm from "./SignInForm";
import { safeRedirect } from "@/lib/memberReturn";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your UK Car Imports account.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Website review 3 Oct 2026 #25 / #49: where to send the member after signing in
  // (same-site paths only), read here so the form renders it without a flash.
  const params = await searchParams;
  const raw = Array.isArray(params.redirect) ? params.redirect[0] : params.redirect;
  const redirect = safeRedirect(raw);
  return (
    <main className={styles.page}>
      <h1 className={styles.heading}>Welcome back</h1>
      <p className={styles.subtext}>Sign in to see your saved cars, saved searches, and notifications.</p>
      <SignInForm redirect={redirect} />
    </main>
  );
}
