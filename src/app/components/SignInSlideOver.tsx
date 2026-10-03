"use client";

import { useState } from "react";
import { setToken } from "@/lib/auth";
import { withRedirect } from "@/lib/memberReturn";
import styles from "./SignInSlideOver.module.css";

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

// Sign-in-on-save: opened from a Save-this-car click while logged out,
// instead of a full-page redirect to /sign-in. Signing in here keeps the
// visitor on the same listing page (scroll position, applied filters)
// and calls onSuccess so the caller can complete the save it was trying
// to do -- matches the AutoTrader pattern this was modelled on.
// Website review 3 Oct 2026 #25: the "Email me new matches" prompt opens it
// too, with its own wording, and "Create account" carries the visitor's
// search through sign-up (returnTo) instead of dropping it.
export default function SignInSlideOver({
  open,
  onClose,
  onSuccess,
  title = "Sign in to save this car",
  subtext = "We’ll email you if a similar car is added to our stock later.",
  submitLabel = "Sign in and save",
  returnTo,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  subtext?: string;
  submitLabel?: string;
  returnTo?: string;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  if (!open) return null;

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
        setForm(EMPTY_FORM);
        setSubmitting(false);
        onSuccess();
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

  // Website review 3 Oct 2026 #24: an unconfirmed member was told to get a
  // fresh link from the sign-up page, which can only resend in the visit that
  // registered. The API flags that refusal (RequiresVerification); resend here.
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

  const back = returnTo || (typeof window !== "undefined" ? window.location.pathname + window.location.search : "");

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.closeBtn} aria-label="Close" onClick={onClose}>
          ×
        </button>
        <h2 className={styles.heading}>{title}</h2>
        <p className={styles.subtext}>{subtext}</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor="slideover-email">EMAIL</label>
            <input
              id="slideover-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            {errors.email && <span className={styles.error}>{errors.email}</span>}
          </div>

          <div className={styles.field}>
            <label htmlFor="slideover-password">PASSWORD</label>
            <input
              id="slideover-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            {errors.password && <span className={styles.error}>{errors.password}</span>}
          </div>

          <button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? "Please wait..." : submitLabel}
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

        <a href={withRedirect("/sign-up", back)} className={styles.signUpLink}>
          Not a user? Create account
        </a>
      </div>
    </div>
  );
}
