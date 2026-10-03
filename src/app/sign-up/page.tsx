import type { Metadata } from "next";
import SignUpForm from "./SignUpForm";
import { safeRedirect } from "@/lib/memberReturn";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Register",
  description: "Create a UK Car Imports account to save cars, save searches, and get notified of new matches.",
};

export default async function SignUpPage({
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
      <h1 className={styles.heading}>Create your account</h1>
      <p className={styles.subtext}>Save cars, save searches, and get emailed when a match appears.</p>
      <SignUpForm redirect={redirect} />
    </main>
  );
}
