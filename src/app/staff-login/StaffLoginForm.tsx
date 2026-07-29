"use client";

import { useState } from "react";
import { setStaffToken, isAdminTokenValid } from "@/lib/auth";
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

export default function StaffLoginForm() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    setServerError("");
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/staff-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (data.ResponseCode == 1) {
        setStaffToken(data.token);
        // The API issues the same JWT shape for every role -- confirm this
        // one is actually admin before sending them into /dashboard, same
        // spirit as the legacy Dashboard.jsx role check.
        if (isAdminTokenValid()) {
          window.location.href = "/dashboard";
        } else {
          setServerError("This account does not have staff access.");
          setSubmitting(false);
        }
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
    </form>
  );
}
