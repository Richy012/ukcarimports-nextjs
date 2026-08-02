"use client";

import { useEffect, useState } from "react";
import { isAdminTokenValid } from "@/lib/auth";

/**
 * Owner-only shortcut from a public car page to that car's row in the admin.
 *
 * Renders NOTHING unless a valid staff token with the admin role is present.
 * The check runs client-side after mount, so the server-rendered HTML never
 * contains this link - a customer, a logged-in member, or a crawler cannot see
 * it in the markup, only an admin's own browser adds it. `isAdminTokenValid`
 * also rejects an expired token and clears it, so a stale session does not keep
 * showing an admin control.
 *
 * The target carries ?car=<id>, which the admin cars list uses to fetch that one
 * car and open it - so the click lands on the full breakdown, price history,
 * AutoTrader link and the sold/freeze actions rather than on page one of 206,000.
 */
export default function AdminCarLink({ carId }: { carId: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(isAdminTokenValid());
  }, []);

  if (!show) return null;

  return (
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
  );
}
