"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (data.ResponseCode == 1) {
        setSent(true);
      } else {
        setError(data.ResponseText || "Something went wrong, please try again.");
        setSubmitting(false);
      }
    } catch {
      setError("Something went wrong, please try again.");
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <>
        <p className={styles.success}>
          If an account exists for that email, we&apos;ve sent a link to reset your password. It&apos;s valid
          for 1 hour.
        </p>
        <div className={styles.links}>
          <Link href="/sign-in">Back to sign in</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="email">EMAIL</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <span className={styles.error}>{error}</span>}
        </div>

        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting ? "Please wait..." : "Send reset link"}
        </button>
      </form>

      <div className={styles.links}>
        <Link href="/sign-in">Back to sign in</Link>
      </div>
    </>
  );
}
