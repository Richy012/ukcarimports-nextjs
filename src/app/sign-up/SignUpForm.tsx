"use client";

import { useState } from "react";
import Link from "next/link";
import { setToken } from "@/lib/auth";
import styles from "./page.module.css";

interface FormState {
  firstname: string;
  lastname: string;
  phone: string;
  email: string;
  password: string;
  marketing_opted_in: boolean;
}

const EMPTY_FORM: FormState = {
  firstname: "",
  lastname: "",
  phone: "",
  email: "",
  password: "",
  marketing_opted_in: false,
};

type FormErrors = Partial<Record<keyof FormState, string>>;

function validate(form: FormState): FormErrors {
  const next: FormErrors = {};
  if (!form.firstname.trim()) next.firstname = "First name is required";
  if (!form.lastname.trim()) next.lastname = "Last name is required";
  if (!form.phone.trim()) next.phone = "Phone is required";
  else if (!/^[0-9+\s-]+$/.test(form.phone)) next.phone = "Enter a valid phone number";
  if (!form.email.trim()) next.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email";
  if (!form.password) next.password = "Password is required";
  return next;
}

export default function SignUpForm() {
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
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
      const signupRes = await fetch(`/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const signupData = await signupRes.json();

      if (signupData.ResponseCode != 1) {
        setServerError(signupData.ResponseText || "Registration failed, please try again.");
        setSubmitting(false);
        return;
      }

      const loginRes = await fetch(`/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const loginData = await loginRes.json();

      if (loginData.ResponseCode == 1) {
        setToken(loginData.token);
        window.location.href = "/";
      } else {
        // Account was created but auto-login failed -- send them to sign in
        // manually rather than leaving them stuck on this form.
        window.location.href = "/sign-in";
      }
    } catch {
      setServerError("Something went wrong, please try again.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="firstname">FIRST NAME</label>
          <input
            id="firstname"
            type="text"
            value={form.firstname}
            onChange={(e) => setForm({ ...form, firstname: e.target.value })}
          />
          {errors.firstname && <span className={styles.error}>{errors.firstname}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="lastname">LAST NAME</label>
          <input
            id="lastname"
            type="text"
            value={form.lastname}
            onChange={(e) => setForm({ ...form, lastname: e.target.value })}
          />
          {errors.lastname && <span className={styles.error}>{errors.lastname}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="phone">PHONE</label>
          <input
            id="phone"
            type="text"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          {errors.phone && <span className={styles.error}>{errors.phone}</span>}
        </div>

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

        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={form.marketing_opted_in}
            onChange={(e) => setForm({ ...form, marketing_opted_in: e.target.checked })}
          />
          Email me offers and promotions from UK Car Imports
        </label>

        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting ? "Please wait..." : "Register"}
        </button>

        {serverError && <p className={styles.error}>{serverError}</p>}
      </form>

      <div className={styles.links}>
        <Link href="/sign-in">Already have an account? Sign in</Link>
      </div>
    </>
  );
}
