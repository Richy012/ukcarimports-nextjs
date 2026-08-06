"use client";

import { useEffect, useState } from "react";
import { isAdminTokenValid, staffAuthHeaders } from "@/lib/auth";

/**
 * Owner-only shortcut from a public car page to that car's row in the admin,
 * plus the seller/garage that is hidden from customers.
 *
 * Renders NOTHING unless a valid staff token with the admin role is present.
 * The check runs client-side after mount, so the server-rendered HTML never
 * contains this link - a customer, a logged-in member, or a crawler cannot see
 * it in the markup, only an admin's own browser adds it. `isAdminTokenValid`
 * also rejects an expired token and clears it, so a stale session does not keep
 * showing an admin control.
 *
 * The seller is FETCHED with the staff token rather than passed in as a prop:
 * a prop handed from the server component to this client component would be
 * serialised into the RSC payload and readable in page source by anyone, which
 * is exactly the leak the public seller line was hidden to avoid.
 *
 * The target carries ?car=<id>, which the admin cars list uses to fetch that one
 * car and open it - so the click lands on the full breakdown, price history,
 * AutoTrader link and the sold/freeze actions rather than on page one of 206,000.
 */
export default function AdminCarLink({ carId }: { carId: string }) {
  const [show, setShow] = useState(false);
  const [seller, setSeller] = useState<string | null>(null);

  useEffect(() => {
    const ok = isAdminTokenValid();
    setShow(ok);
    if (!ok) return;
    fetch("/api/admin-car-detail/" + encodeURIComponent(carId), {
      headers: staffAuthHeaders(),
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const name = d?.car?.auction_company_name ?? d?.auction_company_name ?? null;
        setSeller(typeof name === "string" && name.trim() !== "" ? name : null);
      })
      .catch(() => {});
  }, [carId]);

  if (!show) return null;

  return (
    <>
      <a
        href={`/cars?car=${encodeURIComponent(carId)}`}
        style={{
          display: "inline-block",
          margin: "0 0 14px",
          padding: "7px 14px",
          border: "2px solid #b01112",
          borderRadius: 6,
          color: "#b01112",
          fontWeight: 600,
          fontSize: "0.86rem",
          textDecoration: "none",
          letterSpacing: "0.01em",
        }}
      >
        Admin: open this car &rarr;
      </a>
      {seller ? (
        <span
          style={{
            display: "inline-block",
            margin: "0 0 14px 12px",
            color: "#666",
            fontSize: "0.86rem",
          }}
        >
          Seller/Garage: {seller}
        </span>
      ) : null}
    </>
  );
}
