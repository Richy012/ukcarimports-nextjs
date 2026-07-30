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

interface CarInfo {
  converted_price: number;
  shipping_fee: number;
  customs_agent_fee: number;
  after_irish_vat: number;
  fee: number;
  final_price: number;
  before_vrt_final_price?: number;
  duty_applied: boolean;
  mechanical_inspection_fee: number;
  warranty_premium_max_eligible: boolean;
  warranty_premium_plus_eligible: boolean;
  warranty_premium_component_eligible: boolean;
  warranty_premium_powertrain_eligible: boolean;
  warranty_premium_ev_eligible: boolean;
}

interface WarrantyTier {
  key: string;
  label: string;
  price: number;
  doc: string;
}

function formatEuro(n: number): string {
  return new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 }).format(Math.round(n));
}

function getWarrantyTiers(carInfo: CarInfo, isElectric: boolean): WarrantyTier[] {
  if (isElectric) {
    return carInfo.warranty_premium_ev_eligible
      ? [{ key: "premiumev", label: "Premium EV", price: 395, doc: "premium_ev" }]
      : [];
  }
  const tiers: (WarrantyTier | false)[] = [
    carInfo.warranty_premium_max_eligible && { key: "premiummax", label: "Premium Max", price: 395, doc: "premium_max" },
    carInfo.warranty_premium_plus_eligible && { key: "premiumplus", label: "Premium Plus", price: 395, doc: "premium_plus" },
    carInfo.warranty_premium_component_eligible && { key: "premiumcomp", label: "Premium Component", price: 395, doc: "premium_component" },
    carInfo.warranty_premium_powertrain_eligible && { key: "premiumpowertrain", label: "Premium Power Train", price: 295, doc: "premium_powertrain" },
  ];
  return tiers.filter((t): t is WarrantyTier => !!t);
}

export default function PriceBreakdown({
  carId,
  carName,
  carInfo,
  vrtRate,
  fuelTypeName,
}: {
  carId: string;
  carName: string;
  carInfo: CarInfo;
  vrtRate: number;
  fuelTypeName?: string;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [includeInspection, setIncludeInspection] = useState(false);
  const [includeWarranty, setIncludeWarranty] = useState(false);
  const [selectedWarrantyKey, setSelectedWarrantyKey] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [tnc, setTnc] = useState(false);
  const [fundsInPlace, setFundsInPlace] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [payRedirecting, setPayRedirecting] = useState(false);
  const [payError, setPayError] = useState("");

  async function startOnlineDeposit() {
    setPayRedirecting(true);
    setPayError("");
    try {
      const res = await fetch("/api/create-deposit-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: carId, name, email, phone }),
      });
      const data = await res.json();
      if (data?.ResponseCode == 1 && data.url) {
        window.location.href = data.url;
        return;
      }
      setPayError(data?.ResponseText || "Could not open the payment page. Please try again.");
    } catch {
      setPayError("Could not open the payment page. Please try again.");
    }
    setPayRedirecting(false);
  }

  const isElectric = (fuelTypeName || "").toLowerCase() === "electric";
  const warrantyTiers = getWarrantyTiers(carInfo, isElectric);
  const selectedTier = warrantyTiers.find((t) => t.key === selectedWarrantyKey);
  const warrantyPrice = includeWarranty && selectedTier ? selectedTier.price : 0;

  const displayedTotal = carInfo.final_price + (includeInspection ? carInfo.mechanical_inspection_fee : 0) + warrantyPrice;

  function validateModal(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email";
    if (!phone.trim()) errs.phone = "Phone is required";
    if (!tnc) errs.tnc = "You must accept the Terms and Conditions";
    if (!fundsInPlace) errs.fundsInPlace = "Please confirm you have funds in place";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmitDeposit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateModal()) return;

    setSubmitting(true);
    setSubmitError("");
    try {
      const token: string = await new Promise((resolve) => {
        window.grecaptcha.ready(() => {
          window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: "submit" }).then(resolve);
        });
      });

      const res = await fetch(`/api/submit-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Name: name,
          Email: email,
          Phone: phone,
          inspection_fee: includeInspection ? 1 : 0,
          twelvemonthwarrenty: includeWarranty ? selectedWarrantyKey : "",
          vrt_proccessing: "",
          transferuktodub: "",
          homedelivry: "",
          tnc,
          funds_in_place: fundsInPlace,
          car_id: carId,
          recaptchaToken: token,
        }),
      });
      const data = await res.json();

      if (data.ResponseCode == 1) {
        setSubmitted(true);
      } else {
        setSubmitError(data.ResponseText || "Something went wrong, please try again.");
      }
    } catch {
      setSubmitError("Something went wrong, please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const finalPriceLabel = `Final Price: €${formatEuro(
    (carInfo.before_vrt_final_price ?? carInfo.final_price) +
      (includeInspection ? carInfo.mechanical_inspection_fee : 0) +
      warrantyPrice +
      vrtRate,
  )}`;

  return (
    <div className={styles.priceBox}>
      <Script src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`} strategy="afterInteractive" />

      <div className={styles.price}>€{formatEuro(displayedTotal)}</div>
      <div className={styles.priceNote}>VAT, Duty &amp; VRT included</div>

      <label className={styles.inspectionToggle}>
        <input
          type="checkbox"
          checked={includeInspection}
          onChange={(e) => setIncludeInspection(e.target.checked)}
        />
        Add Mechanical Inspection (€{formatEuro(carInfo.mechanical_inspection_fee)})
      </label>

      {warrantyTiers.length > 0 && (
        <div className={styles.warrantySelector}>
          <label className={styles.inspectionToggle}>
            <input
              type="checkbox"
              checked={includeWarranty}
              onChange={(e) => {
                setIncludeWarranty(e.target.checked);
                if (!e.target.checked) setSelectedWarrantyKey("");
              }}
            />
            Warranty
          </label>
          {includeWarranty && (
            <div className={styles.warrantyTierList}>
              {warrantyTiers.map((t) => (
                <label key={t.key} className={styles.warrantyTierOption}>
                  <input
                    type="radio"
                    name="warranty_tier"
                    checked={selectedWarrantyKey === t.key}
                    onChange={() => setSelectedWarrantyKey(t.key)}
                  />
                  {t.label} 12 months (+€{t.price}){" "}
                  <a href={`${API_BASE}/warranty-docs/${t.doc}.pdf`} target="_blank" rel="noreferrer">
                    click here
                  </a>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <button type="button" className={styles.breakdownToggle} onClick={() => setShowBreakdown((v) => !v)}>
        {showBreakdown ? "Hide price breakdown" : "Show price breakdown"}
      </button>

      {showBreakdown && (
        <dl className={styles.breakdownList}>
          <div className={styles.breakdownRow}>
            <dt>Vehicle price (UK VAT removed)</dt>
            <dd>€{formatEuro(carInfo.converted_price)}</dd>
          </div>
          <div className={styles.breakdownRow}>
            <dt>Shipping</dt>
            <dd>€{formatEuro(carInfo.shipping_fee)}</dd>
          </div>
          <div className={styles.breakdownRow}>
            <dt>Transport &amp; customs agent</dt>
            <dd>€{formatEuro(carInfo.customs_agent_fee)}</dd>
          </div>
          {carInfo.duty_applied && (
            <div className={styles.breakdownRow}>
              <dt>Import duty</dt>
              <dd>Applied</dd>
            </div>
          )}
          <div className={styles.breakdownRow}>
            <dt>Irish VAT-adjusted subtotal</dt>
            <dd>€{formatEuro(carInfo.after_irish_vat)}</dd>
          </div>
          <div className={styles.breakdownRow}>
            <dt>VRT</dt>
            <dd>€{formatEuro(vrtRate)}</dd>
          </div>
          <div className={styles.breakdownRow}>
            <dt>Service fee</dt>
            <dd>€{formatEuro(carInfo.fee)}</dd>
          </div>
          {includeInspection && (
            <div className={styles.breakdownRow}>
              <dt>Mechanical inspection</dt>
              <dd>€{formatEuro(carInfo.mechanical_inspection_fee)}</dd>
            </div>
          )}
          {includeWarranty && selectedTier && (
            <div className={styles.breakdownRow}>
              <dt>Warranty ({selectedTier.label})</dt>
              <dd>€{formatEuro(selectedTier.price)}</dd>
            </div>
          )}
          <div className={`${styles.breakdownRow} ${styles.breakdownTotal}`}>
            <dt>Total price</dt>
            <dd>€{formatEuro(displayedTotal)}</dd>
          </div>
        </dl>
      )}

      <button type="button" className={styles.depositButton} onClick={() => setShowModal(true)}>
        Place A Deposit
      </button>

      {showModal && (
        <div className={styles.depositOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.depositModal} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.depositClose} aria-label="Close" onClick={() => setShowModal(false)}>
              ×
            </button>

            {submitted ? (
              <>
                <h2 className={styles.depositHeading}>Thanks — deposit request sent</h2>
                <p>We&apos;ll get back to you shortly to complete your purchase of {carName}.</p>

                <div className={styles.payNowBlock}>
                  <p className={styles.payNowLead}>
                    Want to secure it right now? Pay the €2,000 deposit online — you&apos;ll be taken
                    to Stripe&apos;s secure checkout (cards, Apple&nbsp;Pay and Google&nbsp;Pay).
                  </p>
                  <button
                    type="button"
                    className={styles.payNowButton}
                    disabled={payRedirecting}
                    onClick={startOnlineDeposit}
                  >
                    {payRedirecting ? "Opening secure checkout..." : "Pay €2,000 deposit securely"}
                  </button>
                  {payError && <p className={styles.error}>{payError}</p>}
                  <p className={styles.payNowSmall}>
                    Refundable per our Terms: walk away after the inspection and it&apos;s returned
                    minus the €395 inspection fee. Prefer a bank transfer? No problem — we&apos;ll be
                    in touch either way.
                  </p>
                </div>
              </>
            ) : (
              <>
                <h2 className={styles.depositHeading}>Place A Deposit</h2>
                <p className={styles.depositCarName}>{carName}</p>

                <form className={styles.depositForm} onSubmit={handleSubmitDeposit} noValidate>
                  <div className={styles.field}>
                    <label htmlFor="deposit-name">NAME</label>
                    <input id="deposit-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
                    {fieldErrors.name && <span className={styles.error}>{fieldErrors.name}</span>}
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="deposit-email">EMAIL</label>
                    <input id="deposit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    {fieldErrors.email && <span className={styles.error}>{fieldErrors.email}</span>}
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="deposit-phone">PHONE</label>
                    <input id="deposit-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    {fieldErrors.phone && <span className={styles.error}>{fieldErrors.phone}</span>}
                  </div>

                  <div className={styles.depositSummary}>
                    <div>Mechanical Inspection: {includeInspection ? `Included (+€${formatEuro(carInfo.mechanical_inspection_fee)})` : "Not included"}</div>
                    <div>Warranty: {includeWarranty && selectedTier ? `${selectedTier.label} 12 Months (+€${selectedTier.price})` : "Not included"}</div>
                  </div>

                  <label className={styles.checkboxField}>
                    <input type="checkbox" checked={tnc} onChange={(e) => setTnc(e.target.checked)} />
                    I accept the Terms and Conditions and Privacy Policy
                  </label>
                  {fieldErrors.tnc && <span className={styles.error}>{fieldErrors.tnc}</span>}

                  <label className={styles.checkboxField}>
                    <input type="checkbox" checked={fundsInPlace} onChange={(e) => setFundsInPlace(e.target.checked)} />
                    I wish to purchase this particular car and have the necessary funds in place to proceed.
                  </label>
                  {fieldErrors.fundsInPlace && <span className={styles.error}>{fieldErrors.fundsInPlace}</span>}

                  <button type="submit" className={styles.depositSubmit} disabled={submitting}>
                    {submitting ? "Please wait..." : finalPriceLabel}
                  </button>

                  {submitError && <p className={styles.error}>{submitError}</p>}
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
