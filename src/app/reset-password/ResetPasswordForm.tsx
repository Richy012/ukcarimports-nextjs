"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

export default function ResetPasswordForm({ u, t, e }: { u: string; t: string; e: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const linkMissing = !u || !t || !e;

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");

    if (!password) {
      setError("Password is required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ u, t, e, password }),
      });
      const data = await res.json();

      if (data.ResponseCode == 1) {
        setDone(true);
      } else {
        setError(data.ResponseText || "Something went wrong, please try again.");
        setSubmitting(false);
      }
    } catch {
      setError("Something went wrong, please try again.");
      setSubmitting(false);
    }
  }

  if (linkMissing) {
    return (
      <>
        <p className={styles.error}>This reset link looks incomplete.</p>
        <div className={styles.links}>
          <Link href="/forgot-password">Request a new link</Link>
        </div>
      </>
    );
  }

  if (done) {
    return (
      <>
        <p className={styles.success}>Your password has been reset.</p>
        <div className={styles.links}>
          <Link href="/sign-in">Sign in</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="password">NEW PASSWORD</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="confirmPassword">CONFIRM PASSWORD</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(ev) => setConfirmPassword(ev.target.value)}
          />
        </div>

        {error && <span className={styles.error}>{error}</span>}

        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting ? "Please wait..." : "Reset password"}
        </button>
      </form>

      <div className={styles.links}>
        <Link href="/sign-in">Back to sign in</Link>
      </div>
    </>
  );
}
