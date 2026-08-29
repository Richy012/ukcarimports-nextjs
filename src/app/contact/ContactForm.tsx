"use client";

import { useState } from "react";
import styles from "./page.module.css";
import { track } from "@/lib/gtm";

const RECAPTCHA_SITE_KEY = "6LdJejIaAAAAABPap2izWvDOKZgwXHDlo4KVmtLs";

// reCAPTCHA is ~660ms of main-thread evaluation (measured on live car pages,
// 2026-08-04) and is only needed once a form is actually in play. Injected on
// demand instead of at page load; grecaptcha.ready() in the submit path
// handles the (rare) case of a submit racing the script.
let recaptchaRequested = false;
function loadRecaptchaScript() {
  if (recaptchaRequested || typeof document === "undefined") return;
  recaptchaRequested = true;
  const s = document.createElement("script");
  s.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
  s.async = true;
  document.head.appendChild(s);
}

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

      const res = await fetch(`/api/add-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, recaptchaToken: token }),
      });
      const data = await res.json();

      if (data.ResponseCode == 1) {
        setForm(EMPTY_FORM);
        setStatus("success");
        // generate_lead died at the 14 Aug GTM cutover (selector-bound container
        // trigger, container not editable) - fired from code instead, same
        // pattern as click_to_call in Header.tsx.
        track("generate_lead", { method: "contact_form" });
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
      <form onFocusCapture={loadRecaptchaScript} className={styles.form} onSubmit={handleSubmit} noValidate>
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
