"use client";

import { useState } from "react";
import Link from "next/link";
import { setToken } from "@/lib/auth";
import { readPendingAlert, safeRedirect, withRedirect } from "@/lib/memberReturn";
import styles from "./page.module.css";

interface FormState {
  email: string;
  password: string;
}

const EMPTY_FORM: FormState = { email: "", password: "" };

function validate(form: FormState): Partial<FormState> {
  const next: Partial<FormState> = {};
  if (!form.email.trim()) next.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email";
  if (!form.password) next.password = "Password is required";
  return next;
}

// Website review 3 Oct 2026 #49: `redirect` is where the member was before being
// sent here (/sign-in?redirect=/my-account/saved-cars), already checked by the page.
export default function SignInForm({ redirect = null }: { redirect?: string | null }) {
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    setServerError("");
    setNeedsConfirm(false);
    setResendMsg("");
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (data.ResponseCode == 1) {
        setToken(data.token);
        // Website review 3 Oct 2026 #49 and #25: back to the page they came
        // from; failing that, to the search they asked to be alerted on
        // before they had an account (it is saved when that page loads);
        // otherwise to their notifications as before.
        const target = safeRedirect(redirect) || readPendingAlert()?.url || "/my-account/notifications";
        window.location.href = target;
      } else {
        setServerError(data.ResponseText || "Login failed, please try again.");
        setNeedsConfirm(Boolean(data.RequiresVerification));
        setSubmitting(false);
      }
    } catch {
      setServerError("Something went wrong, please try again.");
      setSubmitting(false);
    }
  }

  // Website review 3 Oct 2026 #24: the old message sent an unconfirmed member
  // to the sign-up page, which can only resend in the visit that registered.
  async function resendConfirmation() {
    setResendMsg("Sending…");
    try {
      const res = await fetch(`/api/resend-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim() }),
      });
      const data = await res.json();
      setResendMsg(data.ResponseText || "A fresh link is on its way.");
    } catch {
      setResendMsg("Could not resend just now — try again in a minute.");
    }
  }

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="email">EMAIL</label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          {errors.email && <span className={styles.error}>{errors.email}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="password">PASSWORD</label>
          <input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          {errors.password && <span className={styles.error}>{errors.password}</span>}
        </div>

        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting ? "Please wait..." : "Login"}
        </button>

        {serverError && <p className={styles.error}>{serverError}</p>}
        {needsConfirm && (
          <p style={{ margin: "4px 0 0", fontSize: "0.9rem", lineHeight: 1.5 }}>
            <button
              type="button"
              onClick={resendConfirmation}
              style={{ background: "none", border: "none", color: "#b01112", textDecoration: "underline", cursor: "pointer", padding: 0, font: "inherit" }}
            >
              Resend confirmation email
            </button>
            {resendMsg && <span style={{ display: "block", marginTop: 6, color: "#333" }}>{resendMsg}</span>}
          </p>
        )}
      </form>

      <div className={styles.links}>
        <Link href="/forgot-password">Forgot your password?</Link>
        <Link href={withRedirect("/sign-up", redirect)}>Not a user? Create account</Link>
      </div>
    </>
  );
}
