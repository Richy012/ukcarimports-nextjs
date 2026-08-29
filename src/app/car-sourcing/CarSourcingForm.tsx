"use client";

import { track } from "@/lib/gtm";

import { useState, useEffect, useRef } from "react";
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import styles from "./page.module.css";

// Stripe.js pulls in hCaptcha and sets third-party cookies (__cf_bm, __cflb,
// m) the instant it loads -- on every visit, including the ones where nobody
// pays. Deferred until the payment form is about to scroll into view (owner,
// 2026-08-04); same lazy pattern as GTM and reCAPTCHA elsewhere.
// 2026-08-11: ?stripe_test=1 switches the WHOLE flow (publishable key here,
// secret key server-side via the stripe_test flag) onto Stripe TEST mode so
// the owner can run 4242-card checks without touching live money. Customers
// never see this variant.
const STRIPE_PK_TEST = "pk_test_z3Pj22fEGh0WuS9Zb4eiuSQ300xG8EDdlr";
const IS_STRIPE_TEST = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("stripe_test") === "1";
const STRIPE_PK = "pk_live_hvQGGPsKi13bSSCm2zoKHfMi00RCjfXZZS";
let stripeCache: ReturnType<typeof loadStripe> | null = null;
function getStripe() {
  if (!stripeCache) stripeCache = loadStripe(IS_STRIPE_TEST ? STRIPE_PK_TEST : STRIPE_PK);
  return stripeCache;
}

const CARD_ELEMENT_STYLE = {
  base: {
    fontSize: "16px",
    color: "#424770",
    lineHeight: "35px",
    backgroundColor: "#fff",
    "::placeholder": { color: "#aab7c4" },
  },
  invalid: { color: "#9e2146" },
};

interface FormState {
  pay_name: string;
  pay_email: string;
  pay_phone: string;
  pay_address: string;
  pay_zip: string;
  vehicle_link: string;
}

const EMPTY_FORM: FormState = {
  pay_name: "",
  pay_email: "",
  pay_phone: "",
  pay_address: "",
  pay_zip: "",
  vehicle_link: "",
};

const PAY_AMOUNT = 5000; // cents -- matches legacy default (EUR 50.00)

function validate(form: FormState): Partial<FormState> {
  const next: Partial<FormState> = {};
  if (!form.pay_name.trim()) next.pay_name = "Name is required";
  if (!form.pay_email.trim()) next.pay_email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.pay_email)) next.pay_email = "Enter a valid email";
  if (!form.pay_phone.trim()) next.pay_phone = "Phone is required";
  if (!form.pay_address.trim()) next.pay_address = "Address is required";
  if (!form.pay_zip.trim()) next.pay_zip = "Post code is required";
  if (!form.vehicle_link.trim()) next.vehicle_link = "Vehicle link is required";
  return next;
}

function CheckoutForm({
  form,
  errors,
  setErrors,
  onChange,
  onSuccess,
}: {
  form: FormState;
  errors: Partial<FormState>;
  setErrors: (e: Partial<FormState>) => void;
  onChange: (field: keyof FormState, value: string) => void;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!stripe || !elements) return;

    const card = elements.getElement(CardNumberElement);
    if (!card) return;

    setSubmitting(true);
    setPayError("");

    const result = await stripe.createToken(card);
    if (result.error) {
      setPayError(result.error.message ?? "Card error");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/payment-carsourcing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenn: result.token.id,
          ...(IS_STRIPE_TEST ? { stripe_test: "1" } : {}),
          pay_name: form.pay_name,
          pay_email: form.pay_email,
          pay_phone: form.pay_phone,
          pay_address: form.pay_address,
          pay_zip: form.pay_zip,
          pay_amount: PAY_AMOUNT,
          vehicle_link: form.vehicle_link,
        }),
      });
      const data = await res.json();

      if (data.ResponseCode === "1" || data.ResponseCode === 1) {
        onSuccess();
      } else {
        setPayError(data.ResponseText || "Payment failed, please try again.");
        setSubmitting(false);
      }
    } catch {
      setPayError("Something went wrong, please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label htmlFor="pay_name">NAME</label>
        <input
          id="pay_name"
          type="text"
          value={form.pay_name}
          onChange={(e) => onChange("pay_name", e.target.value)}
        />
        {errors.pay_name && <span className={styles.error}>{errors.pay_name}</span>}
      </div>

      <div className={styles.field}>
        <label htmlFor="pay_email">EMAIL</label>
        <input
          id="pay_email"
          type="email"
          value={form.pay_email}
          onChange={(e) => onChange("pay_email", e.target.value)}
        />
        {errors.pay_email && <span className={styles.error}>{errors.pay_email}</span>}
      </div>

      <div className={styles.field}>
        <label htmlFor="pay_phone">PHONE</label>
        <input
          id="pay_phone"
          type="text"
          value={form.pay_phone}
          onChange={(e) => onChange("pay_phone", e.target.value)}
        />
        {errors.pay_phone && <span className={styles.error}>{errors.pay_phone}</span>}
      </div>

      <div className={styles.field}>
        <label htmlFor="pay_address">ADDRESS</label>
        <input
          id="pay_address"
          type="text"
          value={form.pay_address}
          onChange={(e) => onChange("pay_address", e.target.value)}
        />
        {errors.pay_address && <span className={styles.error}>{errors.pay_address}</span>}
      </div>

      <div className={styles.field}>
        <label htmlFor="pay_zip">POST CODE</label>
        <input
          id="pay_zip"
          type="text"
          value={form.pay_zip}
          onChange={(e) => onChange("pay_zip", e.target.value)}
        />
        {errors.pay_zip && <span className={styles.error}>{errors.pay_zip}</span>}
      </div>

      <div className={styles.field}>
        <label htmlFor="vehicle_link">VEHICLE LINK</label>
        <input
          id="vehicle_link"
          type="text"
          value={form.vehicle_link}
          onChange={(e) => onChange("vehicle_link", e.target.value)}
        />
        {errors.vehicle_link && <span className={styles.error}>{errors.vehicle_link}</span>}
      </div>

      <div className={styles.field}>
        <label>CARD NUMBER</label>
        <div className={styles.cardElement}>
          <CardNumberElement options={{ style: CARD_ELEMENT_STYLE }} />
        </div>
      </div>
      <div className={styles.field}>
        <label>EXPIRY</label>
        <div className={styles.cardElement}>
          <CardExpiryElement options={{ style: CARD_ELEMENT_STYLE }} />
        </div>
      </div>
      <div className={styles.field}>
        <label>CVC</label>
        <div className={styles.cardElement}>
          <CardCvcElement options={{ style: CARD_ELEMENT_STYLE }} />
        </div>
      </div>

      <button type="submit" className={styles.submit} disabled={!stripe || submitting}>
        {submitting ? "Please wait..." : "Pay €50"}
      </button>

      {payError && <p className={styles.error}>{payError}</p>}
    </form>
  );
}

export default function CarSourcingForm() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [paid, setPaid] = useState(false);
  // Mount Stripe just before the form reaches the viewport: real visitors
  // never notice, and a page view that never scrolls to it costs nothing.
  const [stripeReady, setStripeReady] = useState(false);
  const stripeGateRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = stripeGateRef.current;
    if (!node || stripeReady) return;
    if (!("IntersectionObserver" in window)) {
      setStripeReady(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setStripeReady(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [stripeReady]);

  function onChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  if (paid) {
    return (
      <div className={styles.form}>
        <p className={styles.success}>Thanks for payment. We will get back to you soon.</p>
      </div>
    );
  }

  // Rendered INLINE, deliberately. This was previously a nested
  // `function ElementsBlock()` declared inside this component and used as
  // `<ElementsBlock />`. A component declared inside another is a NEW function
  // identity on every render, so React treats it as a different element type,
  // unmounts the whole subtree and mounts a fresh one. Here that meant every
  // keystroke (onChange -> setForm -> re-render) destroyed and rebuilt the
  // inputs, and the caret was lost -- the customer had to click back into the
  // field for every single character. Keep this JSX inline; do not extract it
  // to a function declared within this component.
  return (
    <div ref={stripeGateRef}>
      {stripeReady ? (
        <Elements stripe={getStripe()}>
          <CheckoutForm
            form={form}
            errors={errors}
            setErrors={setErrors}
            onChange={onChange}
            onSuccess={() => { setPaid(true); track("generate_lead", { method: "car_sourcing" }); }}
          />
        </Elements>
      ) : (
        <p className={styles.stripeLoading}>Preparing secure payment&hellip;</p>
      )}
    </div>
  );
}
