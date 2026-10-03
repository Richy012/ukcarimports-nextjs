"use client";
import { track } from "@/lib/gtm";

import { useState } from "react";
import Link from "next/link";
import { setToken } from "@/lib/auth";
import { withRedirect } from "@/lib/memberReturn";
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
  // Website review 3 Oct 2026 #48: the same minimum the API and the reset form use.
  else if (form.password.length < 6) next.password = "Use at least 6 characters";
  return next;
}

// Website review 3 Oct 2026 #25: `redirect` (checked by the page) is carried on to
// sign-in, which returns the visitor to the search or page they came from.
export default function SignUpForm({ redirect = null }: { redirect?: string | null }) {
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [awaitingVerify, setAwaitingVerify] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  async function resendLink() {
    setResendMsg("Sending\u2026");
    try {
      const res = await fetch(`/api/resend-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const data = await res.json();
      setResendMsg(data.ResponseText || "A fresh link is on its way.");
    } catch {
      setResendMsg("Could not resend just now \u2014 try again in a minute.");
    }
  }

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

      // Verify-to-complete (2026-08-06): accounts start pending, so there
      // is nothing to auto-login into. Show the check-your-inbox state.
      track("sign_up");
      setAwaitingVerify(true);
      setSubmitting(false);
    } catch {
      setServerError("Something went wrong, please try again.");
      setSubmitting(false);
    }
  }

  if (awaitingVerify) {
    return (
      <div className={styles.form} style={{ textAlign: "center", padding: "28px 20px" }}>
        {/* Website review 3 Oct 2026 #51: in JSX text an escape is printed as typed; in braces it is the envelope. */}
        <div style={{ fontSize: "2.2rem", marginBottom: 10 }} aria-hidden="true">{"\u2709\uFE0F"}</div>
        <h2 style={{ margin: "0 0 10px" }}>Check your inbox</h2>
        <p style={{ lineHeight: 1.65, margin: "0 0 8px" }}>
          We&apos;ve sent a confirmation link to <strong>{form.email}</strong>.
          Click it to activate your account &mdash; then you can sign in, save
          cars and set up alerts.
        </p>
        <p style={{ lineHeight: 1.65, color: "#666", fontSize: "0.9rem", margin: "0 0 18px" }}>
          Nothing arriving? Check your spam folder, or
          {" "}
          <button type="button" onClick={resendLink}
            style={{ background: "none", border: "none", color: "#b01112", textDecoration: "underline", cursor: "pointer", padding: 0, font: "inherit" }}>
            send a fresh link
          </button>.
        </p>
        {resendMsg && <p style={{ fontSize: "0.85rem", color: "#333" }}>{resendMsg}</p>}
        <p style={{ lineHeight: 1.65, margin: "14px 0 0" }}>
          Once it&apos;s confirmed, <Link href={withRedirect("/sign-in", redirect)}>sign in</Link>
          {redirect ? " and we\u2019ll take you back to where you were." : "."}
        </p>
      </div>
    );
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

        {/* Owner, 2026-08-24: tell people up front that an account which never
            saves anything is removed -- "what are they members for if not
            searching for a car?" -- but still let them register. Measured that
            day: 23 of 33 members had saved nothing, and 11 were deleted. */}
        <p
          style={{
            fontSize: "0.85rem",
            color: "#666",
            lineHeight: 1.6,
            margin: "4px 0 16px",
          }}
        >
          An account is how we know what you&rsquo;re looking for. Save a car or a search and
          we&rsquo;ll email you when a matching one lands. Accounts with{" "}
          {/* Website review 3 Oct 2026 #23: the real grace period (owner's rule, 31 Aug 2026:
              /root/purge_stale_signups.sh, daily), not the 30 days this used to say. */}
          <strong>no saved car or search are removed after 24 hours</strong>.
        </p>

        <button type="submit" className={styles.submit} disabled={submitting}>
          {submitting ? "Please wait..." : "Register"}
        </button>

        {serverError && <p className={styles.error}>{serverError}</p>}
      </form>

      <div className={styles.links}>
        <Link href={withRedirect("/sign-in", redirect)}>Already have an account? Sign in</Link>
      </div>
    </>
  );
}
