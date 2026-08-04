"use client";

import { gtmPush } from "@/lib/gtm";
import { CarFront, CircleCheck, ClipboardCheck, HandCoins, Lock, ShieldCheck, ShieldPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { isAdminTokenValid, staffAuthHeaders } from "@/lib/auth";
import Link from "next/link";
import styles from "./page.module.css";

const API_BASE = "https://api.ukcarimports.ie/public";
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

/**
 * The admin-only cost breakdown, fetched separately from an endpoint that
 * checks the staff token server-side. These numbers are NOT in the page
 * payload for anyone - page.tsx deletes them - so a visitor or a signed-in
 * member cannot read them from DevTools.
 *
 * Field names follow the admin endpoint, which differs from car_info: the
 * VAT-free vehicle price is vat_free_eur there and converted_price here, and
 * the service fee is service_fee rather than fee.
 */
interface StaffBreakdown {
  export_fee_gbp?: number | null;
  export_fee_dealer?: string | null;
  vat_free_eur: number;
  shipping_fee: number;
  customs_agent_fee: number;
  customs_clearance_fee?: number;
  after_irish_vat: number;
  service_fee: number;
  duty_applied: boolean;
}

interface CarInfo {
  final_price: number;
  before_vrt_final_price?: number;
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
  heroImage,
  vrm,
  carInfo,
  vrtRate,
  fuelTypeName,
}: {
  carId: string;
  carName: string;
  heroImage?: string | null;
  vrm?: string | null;
  carInfo: CarInfo;
  vrtRate: number;
  fuelTypeName?: string;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  // Staff only. The breakdown itemises our cost base and margin, so it is not
  // shown to the public or to signed-in members.
  const [isStaff, setIsStaff] = useState(false);
  useEffect(() => {
    setIsStaff(isAdminTokenValid());
  }, []);

  // "Reserve Now" deep link (My Notifications): land with the deposit modal
  // already open, exactly as if Place A Deposit had been clicked.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("reserve") === "1") {
      setShowModal(true);
    loadRecaptchaScript();
      startAvailabilityCheck();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Requested only when the toggle is actually opened, and only with a valid
  // staff token - so for everyone else there is no response in the network tab
  // to inspect either.
  const [staff, setStaff] = useState<StaffBreakdown | null>(null);
  const [staffVrt, setStaffVrt] = useState<{
    co2Charge: number | null;
    co2Gkm: string | null;
    noxCharge: number | null;
    noxMg: number | null;
    noxSource: string | null;
  } | null>(null);
  useEffect(() => {
    if (!showBreakdown || staff || !isAdminTokenValid()) return;
    fetch(`/api/staff-car-detail/${carId}`, { headers: staffAuthHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setStaff(d?.data?.breakdown ?? null);
        setStaffVrt(
          d?.data
            ? {
                co2Charge: d.data.vrt_co2_charge ?? null,
                co2Gkm: d.data.co2_gkm ?? null,
                noxCharge: d.data.nox_charge ?? null,
                noxMg: d.data.nox_value ?? null,
                noxSource: d.data.nox_source ?? null,
              }
            : null,
        );
      })
      .catch(() => setStaff(null));
  }, [showBreakdown, staff, carId]);
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
  const [availability, setAvailability] = useState<"unknown" | "checking" | "available" | "sold" | "timeout">(
    "unknown"
  );
  const [availMake, setAvailMake] = useState<string | null>(null);

  // Fired when the modal opens: DB answers instantly for known-sold cars;
  // otherwise the scraper fleet verifies the live ad while the customer types.
  async function startAvailabilityCheck() {
    if (availability !== "unknown") return;
    setAvailability("checking");
    try {
      const res = await fetch("/api/check-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car_id: carId }),
      });
      const data = await res.json();
      const d = data?.data;
      if (!d) {
        setAvailability("timeout");
        return;
      }
      setAvailMake(d.make ?? null);
      if (d.status === "sold" || d.status === "available") {
        setAvailability(d.status);
        return;
      }
      let polls = 0;
      const poll = async () => {
        polls += 1;
        try {
          const r = await fetch(`/api/availability-result/${d.check_id}`);
          const j = await r.json();
          const s = j?.data?.status;
          if (s === "sold" || s === "available") {
            setAvailability(s);
            return;
          }
          if (s === "timeout" || polls >= 12) {
            setAvailability("timeout");
            return;
          }
        } catch {
          /* keep polling */
        }
        setTimeout(poll, 5000);
      };
      setTimeout(poll, 5000);
    } catch {
      setAvailability("timeout");
    }
  }

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
        gtmPush({
          event: "begin_checkout",
          currency: "EUR",
          value: 2000,
          checkout_kind: "vehicle_deposit",
        });
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
          twelvemonthwarrenty: includeWarranty ? selectedWarrantyKey : "0",
          vrt_proccessing: "0",
          transferuktodub: "0",
          homedelivry: "0",
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
      <div className={styles.price}>€{formatEuro(displayedTotal)}</div>
      <div className={styles.priceNote}>
        Price is all inclusive &mdash; that is to have your car here in ROI, in your name, on Irish plates
      </div>

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
            <span className={styles.optionHint}>&mdash; click the box for more choices</span>
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

      {isStaff && (
        <button type="button" className={styles.breakdownToggle} onClick={() => setShowBreakdown((v) => !v)}>
          {showBreakdown ? "Hide price breakdown" : "Show price breakdown"}
        </button>
      )}

      {isStaff && showBreakdown && staff && (
        <dl className={styles.breakdownList}>
          <div className={styles.breakdownRow}>
            <dt>Vehicle price (UK VAT removed)</dt>
            <dd>€{formatEuro(staff.vat_free_eur)}</dd>
          </div>
          <div className={styles.breakdownRow}>
            <dt>Shipping</dt>
            <dd>€{formatEuro(staff.shipping_fee)}</dd>
          </div>
          {staff.duty_applied && (
            <div className={styles.breakdownRow}>
              <dt>Import duty (10%)</dt>
              <dd>Applied</dd>
            </div>
          )}
          <div className={styles.breakdownRow}>
            <dt>Subtotal after duty &amp; Irish VAT</dt>
            <dd>€{formatEuro(staff.after_irish_vat)}</dd>
          </div>
          {staff.export_fee_gbp ? (
            <div className={styles.breakdownRow}>
              <dt>Export/trade fee — {staff.export_fee_dealer}</dt>
              <dd>£{staff.export_fee_gbp} (in vehicle price)</dd>
            </div>
          ) : null}
          <div className={styles.breakdownRow}>
            <dt>Customs clearance</dt>
            <dd>€{formatEuro(staff.customs_clearance_fee ?? 200)}</dd>
          </div>
          <div className={styles.breakdownRow}>
            <dt>Transport (garage &rarr; Liverpool port)</dt>
            <dd>€{formatEuro(staff.customs_agent_fee)}</dd>
          </div>
          <div className={styles.breakdownRow}>
            <dt>VRT</dt>
            <dd>€{formatEuro(vrtRate)}</dd>
          </div>
          {staffVrt && staffVrt.co2Charge !== null && (
            <div className={styles.breakdownRow}>
              <dt style={{ paddingLeft: 14, opacity: 0.85 }}>
                &mdash; CO&#8322; element{staffVrt.co2Gkm ? ` · ${staffVrt.co2Gkm} g/km` : ""}
              </dt>
              <dd>€{formatEuro(staffVrt.co2Charge)}</dd>
            </div>
          )}
          {staffVrt && staffVrt.noxCharge !== null && (
            <div className={styles.breakdownRow}>
              <dt style={{ paddingLeft: 14, opacity: 0.85 }}>
                &mdash; NOx element
                {staffVrt.noxMg !== null ? ` · ${staffVrt.noxMg} mg/km` : ""}
                {staffVrt.noxSource === "statcode_capped" ? " (capped)" : ""}
                {staffVrt.noxSource === "engine_default" ? " (default)" : ""}
              </dt>
              <dd>€{formatEuro(staffVrt.noxCharge)}</dd>
            </div>
          )}
          <div className={styles.breakdownRow}>
            <dt>Service fee</dt>
            <dd>€{formatEuro(staff.service_fee)}</dd>
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

      <button
        type="button"
        className={styles.depositButton}
        onClick={() => {
          setShowModal(true);
    loadRecaptchaScript();
          startAvailabilityCheck();
        }}
      >
        {vrm ? `Place A Deposit on ${String(vrm).toUpperCase()}` : "Place A Deposit"}
      </button>

      {showModal && (
        <div className={styles.depositOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.depositModal} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.depositClose} aria-label="Close" onClick={() => setShowModal(false)}>
              ×
            </button>

            <div
              className={styles.depositHero}
              style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined}
            >
              <div className={styles.depositHeroShade} />
              <div className={styles.depositHeroText}>
                <span className={styles.depositHeroName}>{carName}</span>
                <span className={styles.depositGoldDash} aria-hidden="true" />
                <span className={styles.depositHeroPrice}>{finalPriceLabel}</span>
              </div>
            </div>
            <div className={styles.depositBody}>

            {availability === "sold" ? (
              <>
                <h2 className={styles.depositHeading}>
                  Sorry — this {availMake ? availMake.replace(/\b\w/g, (c) => c.toUpperCase()) : "car"} has
                  now sold
                </h2>
                <p>
                  The seller has just marked it gone — the best-value cars move fast. No money has
                  been taken.
                </p>
                <p>
                  New stock lands every day: save a search for one like this and we&apos;ll email you
                  the moment a match arrives.
                </p>
                <a href="/used-cars" className={styles.payNowButton} style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                  Browse similar cars
                </a>
              </>
            ) : submitted ? (
              <>
                <h2 className={styles.depositHeading}>Thanks — deposit request sent</h2>
                <p>We&apos;ll get back to you shortly to complete your purchase of {carName}.</p>

                <div className={styles.payNowBlock}>
                  {availability === "available" ? (
                    <>
                      <p className={styles.payNowLead}>
                        <CircleCheck size={15} strokeWidth={1.75} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} /> Availability confirmed. Want to secure it right now? Pay the €2,000 deposit
                        online — you&apos;ll be taken to Stripe&apos;s secure checkout (cards,
                        Apple&nbsp;Pay and Google&nbsp;Pay).
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
                    </>
                  ) : (
                    <p className={styles.payNowLead}>
                      We&apos;re just confirming the car is still available with the seller —
                      we&apos;ll email you a secure payment link the moment it&apos;s verified, so
                      you never pay for a car that&apos;s already gone.
                    </p>
                  )}
                  <p className={styles.payNowSmall}>
                    Prefer a bank transfer? No problem — we&apos;ll be in touch either way.
                  </p>
                </div>
              </>
            ) : (
              <>
                <h2 className={styles.depositHeading}>Reserve this car</h2>
                <div className={styles.depositJourney}>
                  <span><HandCoins size={16} strokeWidth={1.75} aria-hidden="true" /> €2,000 deposit today</span>
                  <span><ClipboardCheck size={16} strokeWidth={1.75} aria-hidden="true" /> Optional €395 inspection</span>
                  <span><ShieldPlus size={16} strokeWidth={1.75} aria-hidden="true" /> Optional warranty from €295</span>
                  <span><CarFront size={16} strokeWidth={1.75} aria-hidden="true" /> Irish plates in ~2 weeks</span>
                </div>
                <div className={styles.stripeStrip}>
                  <ShieldCheck size={18} strokeWidth={1.75} aria-hidden="true" />
                  <span>
                    <strong>New — pay online, securely.</strong> Your €2,000 deposit can now be
                    paid through <strong>Stripe</strong> — card, Apple&nbsp;Pay or Google&nbsp;Pay,
                    with bank-level encryption. Refund terms are set out in our{" "}
                    <Link href="/terms-and-conditions">Terms &amp; Conditions</Link>.
                  </span>
                </div>

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
                    <div>Mechanical Inspection: {includeInspection ? `Included (+€${formatEuro(carInfo.mechanical_inspection_fee)})` : <strong>Not included</strong>}</div>
                    <div>Warranty: {includeWarranty && selectedTier ? `${selectedTier.label} 12 Months (+€${selectedTier.price})` : <strong>Not included</strong>}</div>
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

                  <p className={styles.securePayBar}>
                    <Lock size={13} strokeWidth={2} aria-hidden="true" /> Payments secured by{" "}
                    <strong>Stripe</strong> · Card · Apple&nbsp;Pay · Google&nbsp;Pay
                  </p>

                  {submitError && <p className={styles.error}>{submitError}</p>}
                </form>
              </>
            )}
              </div>
          </div>
        </div>
      )}
    </div>
  );
}
