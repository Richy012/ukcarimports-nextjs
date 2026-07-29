"use client";

import { useState } from "react";
import { API_BASE, setToken } from "@/lib/auth";
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
export default function SignInSlideOver({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    setServerError("");
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/login`, {
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
        setSubmitting(false);
      }
    } catch {
      setServerError("Something went wrong, please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.closeBtn} aria-label="Close" onClick={onClose}>
          ×
        </button>
        <h2 className={styles.heading}>Sign in to save this car</h2>
        <p className={styles.subtext}>
          We&apos;ll email you if a similar car is added to our stock later.
        </p>

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
            {submitting ? "Please wait..." : "Sign in and save"}
          </button>

          {serverError && <p className={styles.error}>{serverError}</p>}
        </form>

        <a href="/sign-up" className={styles.signUpLink}>
          Not a user? Create account
        </a>
      </div>
    </div>
  );
}
