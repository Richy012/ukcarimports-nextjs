"use client";

import { useEffect, useState } from "react";
import { staffAuthHeaders } from "@/lib/auth";
import styles from "./page.module.css";

interface DepositRow {
  id: number;
  car_id: string;
  car_name: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  amount_cents: number;
  status: "pending" | "paid" | "refunded_partial" | "refunded_full" | "canceled";
  refunded_amount_cents: number | null;
  created_at: string;
  paid_at: string | null;
  refunded_at: string | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Checkout opened", cls: "badgeGrey" },
  paid: { label: "PAID", cls: "badgePaid" },
  refunded_partial: { label: "Refunded − €395", cls: "badgeRefund" },
  refunded_full: { label: "Refunded in full", cls: "badgeRefund" },
  canceled: { label: "Canceled", cls: "badgeGrey" },
};

function euro(cents: number | null): string {
  return cents === null ? "-" : "€" + (cents / 100).toLocaleString();
}

export default function DepositsClient() {
  const [rows, setRows] = useState<DepositRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  function load() {
    fetch("/api/staff-deposits", { headers: staffAuthHeaders() })
      .then((res) => res.json())
      .then((data) => setRows(data?.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function refund(row: DepositRow, mode: "partial" | "full") {
    const desc =
      mode === "partial"
        ? `Refund ${euro(row.amount_cents - 39500)} (deposit minus the €395 inspection fee) to ${row.customer_name}?`
        : `Refund the FULL ${euro(row.amount_cents)} to ${row.customer_name}?`;
    if (!window.confirm(`${desc}\n\nThis goes back to their card via Stripe and cannot be undone.`)) return;
    setBusyId(row.id);
    fetch(`/api/staff-deposit-refund/${row.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...staffAuthHeaders() },
      body: JSON.stringify({ mode }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ResponseCode == 1) {
          load();
        } else {
          alert(data?.ResponseText || "Refund failed");
        }
      })
      .finally(() => setBusyId(null));
  }

  return (
    <>
      <div className={styles.headerRow}>
        <h1 className={styles.heading}>Deposits</h1>
        <span className={styles.countText}>
          {rows.filter((r) => r.status === "paid").length} paid &middot; {rows.length} total
        </span>
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.tableHead}>
          <span>Customer</span>
          <span>Car</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Dates</span>
          <span>Actions</span>
        </div>
        {loading && <div className={styles.emptyRow}>Loading...</div>}
        {!loading && rows.length === 0 && (
          <div className={styles.emptyRow}>No online deposits yet. Rows appear the moment a customer opens Stripe checkout.</div>
        )}
        {!loading &&
          rows.map((row) => {
            const status = STATUS_LABEL[row.status] ?? STATUS_LABEL.pending;
            return (
              <div key={row.id} className={styles.tableRow}>
                <div className={styles.cellStack}>
                  <span>{row.customer_name}</span>
                  <span className={styles.sub}>{row.customer_email}</span>
                  <span className={styles.sub}>{row.customer_phone ?? ""}</span>
                </div>
                <div className={styles.cellStack}>
                  <span className={styles.sub}>{row.car_name ?? row.car_id}</span>
                  <span className={styles.sub}>
                    <a href={`https://ukcarimports.ie/car/${row.car_id}`} target="_blank" rel="noreferrer">
                      {row.car_id}
                    </a>
                  </span>
                </div>
                <span>
                  {euro(row.amount_cents)}
                  {row.refunded_amount_cents !== null && (
                    <span className={styles.sub}> ({euro(row.refunded_amount_cents)} refunded)</span>
                  )}
                </span>
                <span className={styles[status.cls]}>{status.label}</span>
                <div className={styles.cellStack}>
                  <span className={styles.sub}>opened {row.created_at}</span>
                  {row.paid_at && <span className={styles.sub}>paid {row.paid_at}</span>}
                  {row.refunded_at && <span className={styles.sub}>refunded {row.refunded_at}</span>}
                </div>
                <div className={styles.cellStack}>
                  {row.status === "paid" && (
                    <>
                      <button
                        type="button"
                        className={styles.refundBtn}
                        disabled={busyId === row.id}
                        onClick={() => refund(row, "partial")}
                      >
                        Refund − €395
                      </button>
                      <button
                        type="button"
                        className={styles.refundBtnGhost}
                        disabled={busyId === row.id}
                        onClick={() => refund(row, "full")}
                      >
                        Refund in full
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
}
