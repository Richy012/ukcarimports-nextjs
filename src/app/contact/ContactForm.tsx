"use client";

import { useState } from "react";
import Script from "next/script";
import styles from "./page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";
const RECAPTCHA_SITE_KEY = "6LdJejIaAAAAABPap2izWvDOKZgwXHDlo4KVmtLs";

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

interface FormState {
  fullname: string;
  email: string;
  phone: string;
  message: string;
}

const EMPTY_FORM: FormState = { fullname: "", email: "", phone: "", message: "" };

export default function ContactForm() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  function validate(): boolean {
    const next: Partial<FormState> = {};
    if (!form.fullname.trim()) next.fullname = "Name is required";
    if (!form.email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email";
    if (!form.phone.trim()) next.phone = "Phone is required";
    if (!form.message.trim()) next.message = "Message is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setStatus("idle");

    try {
      const token: string = await new Promise((resolve) => {
        window.grecaptcha.ready(() => {
          window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: "submit" }).then(resolve);
        });
      });

      const res = await fetch(`${API_BASE}/add-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, recaptchaToken: token }),
      });
      const data = await res.json();

      if (data.ResponseCode == 1) {
        setForm(EMPTY_FORM);
        setStatus("success");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Script src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`} strategy="afterInteractive" />
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="fullname">YOUR NAME</label>
          <input
            id="fullname"
            type="text"
            value={form.fullname}
            onChange={(e) => setForm({ ...form, fullname: e.target.value })}
          />
          {errors.fullname && <span className={styles.error}>{errors.fullname}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="phone">YOUR PHONE</label>
          <input
            id="phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          {errors.phone && <span className={styles.error}>{errors.phone}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="email">YOUR EMAIL</label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          {errors.email && <span className={styles.error}>{errors.email}</span>}
        </div>

        <div className={styles.field}>
          <label htmlFor="message">MESSAGE</label>
          <textarea
            id="message"
            rows={5}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
          {errors.message && <span className={styles.error}>{errors.message}</span>}
        </div>

        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting ? "Please wait..." : "Submit"}
        </button>

        {status === "success" && (
          <p className={styles.success}>Form submitted successfully — we&apos;ll get back to you soon.</p>
        )}
        {status === "error" && (
          <p className={styles.error}>Something went wrong — please try again.</p>
        )}
      </form>
    </>
  );
}
