"use client";
import { track } from "@/lib/gtm";

import { gtmPush } from "@/lib/gtm";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";

interface DepositInfo {
  status: string;
  car_id: string;
  car_name: string;
  customer_name: string;
  amount_cents: number;
}

// The redirect back from Stripe is never trusted on its own: this page asks
// our backend, which verifies the session against Stripe's API server-side.
export default function DepositSuccessClient() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const [info, setInfo] = useState<DepositInfo | null>(null);
  const [state, setState] = useState<"checking" | "paid" | "pending" | "error">("checking");

  useEffect(() => {
    if (!sessionId) {
      setState("error");
      return;
    }
    let attempts = 0;
    let cancelled = false;
    function check() {
      fetch(`/api/deposit-status/${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          const d = data?.data;
          if (d?.status === "paid") {
            try {
              if (!sessionStorage.getItem("dp_" + sessionId)) {
                sessionStorage.setItem("dp_" + sessionId, "1");
                track("deposit_paid", { currency: "EUR", value: 2000 });
              }
            } catch {}
            gtmPush({
              event: "purchase",
              currency: "EUR",
              value: 2000,
              transaction_id: sessionId,
              checkout_kind: "vehicle_deposit",
            });
            setInfo(d);
            setState("paid");
          } else if (d && attempts < 5) {
            attempts += 1;
            setTimeout(check, 2500);
          } else if (d) {
            setInfo(d);
            setState("pending");
          } else {
            setState("error");
          }
        })
        .catch(() => !cancelled && setState("error"));
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <main className={styles.page}>
      {state === "checking" && <p className={styles.checking}>Confirming your payment...</p>}

      {state === "paid" && info && (
        <div className={styles.card}>
          <div className={styles.tick}><Check size={34} strokeWidth={2.5} aria-hidden="true" /></div>
          <h1>Deposit received — the car is being secured</h1>
          <p>
            Thanks {info.customer_name}. Your €{Math.round(info.amount_cents / 100).toLocaleString()}{" "}
            deposit for <strong>{info.car_name}</strong> has been received. Stripe has emailed you a
            receipt.
          </p>
          <p>
            Next, we secure the car with the garage. If you selected a mechanical inspection,
            we&apos;ll organise that too, and you&apos;ll receive the full report with photos.
          </p>
          <Link href={`/car/${info.car_id}`} className={styles.backLink}>
            Back to your car
          </Link>
        </div>
      )}

      {state === "pending" && (
        <div className={styles.card}>
          <h1>Payment is processing</h1>
          <p>
            Your payment hasn&apos;t been confirmed by Stripe yet. This can take a minute — we&apos;ll
            also verify it on our side, so there&apos;s nothing more you need to do. If you don&apos;t
            receive a Stripe receipt by email shortly, call us on 01-556 8261.
          </p>
        </div>
      )}

      {state === "error" && (
        <div className={styles.card}>
          <h1>We couldn&apos;t verify this payment link</h1>
          <p>
            If you completed a payment, don&apos;t worry — your Stripe receipt is proof and we
            verify every payment on our side. Call us on 01-556 8261 or email{" "}
            <a href="mailto:info@ukcarimports.ie">info@ukcarimports.ie</a> and we&apos;ll confirm
            immediately.
          </p>
        </div>
      )}
    </main>
  );
}
