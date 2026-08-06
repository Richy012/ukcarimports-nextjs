"use client";

import { useEffect, useState } from "react";
import { isAdminTokenValid, staffAuthHeaders } from "@/lib/auth";

/**
 * Owner-only seller/garage line on a public car page.
 *
 * The public line was hidden on 2026-08-05 because the seller data is
 * unreliable (blank rows show as "Private Seller", and named garages can be
 * wrong too) -- but the owner still needs to see who is selling when he is
 * logged in as admin, so this restores it for admins ONLY.
 *
 * auction_company_name is deliberately stripped from the public car payload,
 * so unlike AdminCarLink this cannot read the value off the page -- it has to
 * fetch it from the admin-gated endpoint, which 403s anyone who is not an
 * admin. That means the seller name is never present in the HTML a customer
 * or a crawler receives, only in an authenticated admin's own browser.
 *
 * Renders nothing at all until the token check passes AND the fetch returns,
 * so there is no flash of an empty row for ordinary visitors.
 */
export default function AdminSellerLine({ carId }: { carId: string }) {
  const [seller, setSeller] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdminTokenValid()) return;
    let cancelled = false;

    fetch(`/api/staff-car-detail/${encodeURIComponent(carId)}`, {
      headers: staffAuthHeaders(),
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        const name = j?.data?.auction_company_name;
        if (typeof name === "string" && name.trim() !== "") setSeller(name.trim());
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [carId]);

  if (!seller) return null;

  return (
    <p
      style={{
        margin: "0 0 12px",
        padding: "6px 10px",
        display: "inline-block",
        border: "1px dashed #b01112",
        borderRadius: 6,
        color: "#b01112",
        fontSize: "0.85rem",
        fontWeight: 600,
      }}
    >
      Admin only &mdash; Seller/Garage: {seller}
    </p>
  );
}
