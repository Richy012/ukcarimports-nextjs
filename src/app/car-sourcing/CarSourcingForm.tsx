"use client";

import { useState } from "react";
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

const API_BASE = "https://api.ukcarimports.ie/public";
const stripePromise = loadStripe("pk_live_hvQGGPsKi13bSSCm2zoKHfMi00RCjfXZZS");

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
      const res = await fetch(`${API_BASE}/payment-carsourcing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenn: result.token.id,
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

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm
        form={form}
        errors={errors}
        setErrors={setErrors}
        onChange={onChange}
        onSuccess={() => setPaid(true)}
      />
    </Elements>
  );
}
