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
  status: "pending" | "authorized" | "paid" | "refunded_partial" | "refunded_full" | "canceled";
  refunded_amount_cents: number | null;
  created_at: string;
  paid_at: string | null;
  refunded_at: string | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Checkout opened", cls: "badgeGrey" },
  // Card authorised, money held, NOTHING CHARGED YET. Capture takes it;
  // releasing costs nothing. Card holds expire after about 7 days.
  authorized: { label: "HELD - capture or release", cls: "badgeGrey" },
  paid: { label: "PAID", cls: "badgePaid" },
  refunded_partial: { label: "Refunded, less €395 fee", cls: "badgeRefund" },
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
  // Refunded deposits are closed business and were cluttering the list, so they
  // are hidden by default. The rows are NOT deleted: they are Stripe accounting
  // records and the backend refuses to delete paid/refunded rows (see below).
  const [showRefunded, setShowRefunded] = useState(false);

  const isRefunded = (r: DepositRow) =>
    r.status === "refunded_full" || r.status === "refunded_partial";
  const refundedCount = rows.filter(isRefunded).length;
  const visibleRows = showRefunded ? rows : rows.filter((r) => !isRefunded(r));

  // Deposits are AUTHORISED, not charged, until captured here. Capturing takes
  // the money; releasing costs nothing, which is the whole reason for the
  // manual-capture flow (a refunded €2,000 deposit lost €37 in Stripe fees on
  // 2026-08-24, because Stripe never returns its fee on a refund).
  function holdAction(row: DepositRow, action: "capture" | "cancel") {
    const msg =
      action === "capture"
        ? `Capture ${euro(row.amount_cents)} from ${row.customer_name}? This charges the card now.`
        : `Release the hold on ${row.customer_name}'s card? Nothing was charged, so this costs nothing.`;
    if (!window.confirm(msg)) return;
    setBusyId(row.id);
    fetch(`/api/staff-deposit-${action}/${row.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...staffAuthHeaders() },
      body: JSON.stringify({}),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ResponseCode == 1) load();
        else alert(data?.ResponseText || "Action failed");
      })
      .finally(() => setBusyId(null));
  }
  const captureHold = (row: DepositRow) => holdAction(row, "capture");
  const releaseHold = (row: DepositRow) => holdAction(row, "cancel");

  function load() {
    fetch("/api/staff-deposits", { headers: staffAuthHeaders() })
      .then((res) => res.json())
      .then((data) => setRows(data?.data ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // Owner, 2026-09-10: a delivered car's deposit used to sit here for ever
  // beside two refund buttons. Closing archives the row (money untouched,
  // record kept in deposit_payments_archive) so it can never be refunded by
  // accident.
  function closeDeposit(row: DepositRow) {
    if (
      !window.confirm(
        `Close the ${euro(row.amount_cents)} deposit for ${row.customer_name}?\n\n` +
          "Use this once the car has been delivered. No money moves — the record is archived " +
          "and leaves this list, so it can never be refunded by mistake.",
      )
    ) {
      return;
    }
    setBusyId(row.id);
    fetch(`/api/staff-deposit-close/${row.id}`, {
      method: "POST",
      headers: { ...staffAuthHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ reason: "car delivered — closed by staff" }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.ResponseCode === "1") {
          setRows((prev) => prev.filter((r) => r.id !== row.id));
        } else {
          alert(data?.ResponseText || "Could not close this deposit");
        }
      })
      .catch(() => alert("Could not close this deposit"))
      .finally(() => setBusyId(null));
  }

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

  // Only never-paid records (abandoned checkouts, test rows) can be deleted;
  // the backend refuses paid/refunded rows — those are accounting records.
  function remove(row: DepositRow) {
    if (
      !window.confirm(
        `Delete this "${row.status}" deposit record for ${row.customer_name}?\n\nNo money was taken on this record. This only removes the row — it cannot be undone.`
      )
    )
      return;
    setBusyId(row.id);
    fetch(`/api/staff-deposit-delete/${row.id}`, {
      method: "POST",
      headers: staffAuthHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ResponseCode == 1) {
          load();
        } else {
          alert(data?.ResponseText || "Delete failed");
        }
      })
      .finally(() => setBusyId(null));
  }

  return (
    <>
      <div className={styles.headerRow}>
        <h1 className={styles.heading}>Deposits</h1>
        <span className={styles.countText}>
          {rows.filter((r) => r.status === "paid").length} paid &middot; {visibleRows.length} total
          {refundedCount > 0 && (
            <>
              {" "}
              &middot;{" "}
              <button
                type="button"
                onClick={() => setShowRefunded((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  font: "inherit",
                  color: "inherit",
                  opacity: 0.7,
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                {showRefunded ? "hide" : "show"} {refundedCount} refunded
              </button>
            </>
          )}
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
        {!loading && visibleRows.length === 0 && rows.length === 0 && (
          <div className={styles.emptyRow}>No online deposits yet. Rows appear the moment a customer opens Stripe checkout.</div>
        )}
        {!loading && visibleRows.length === 0 && rows.length > 0 && (
          <div className={styles.emptyRow}>No open deposits. All {rows.length} are refunded — use &ldquo;show refunded&rdquo; above.</div>
        )}
        {!loading &&
          visibleRows.map((row) => {
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
                        style={{ background: "#0a7d33", borderColor: "#0a7d33" }}
                        disabled={busyId === row.id}
                        onClick={() => closeDeposit(row)}
                        title="The car has been delivered: archive this deposit so it leaves the list and cannot be refunded by mistake"
                      >
                        Car delivered — close
                      </button>
                      <button
                        type="button"
                        className={styles.refundBtn}
                        disabled={busyId === row.id}
                        onClick={() => refund(row, "partial")}
                        title="Refunds the deposit balance; the €395 inspection fee is retained"
                      >
                        Refund {euro(row.amount_cents - 39500)} (keep €395)
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
                  {row.status === "authorized" && (
                    <>
                      <button
                        type="button"
                        className={styles.refundBtn}
                        disabled={busyId === row.id}
                        onClick={() => captureHold(row)}
                        title="Charges the card. Do this once you have confirmed the car and the price."
                      >
                        Capture {euro(row.amount_cents)}
                      </button>
                      <button
                        type="button"
                        className={styles.refundBtnGhost}
                        disabled={busyId === row.id}
                        onClick={() => releaseHold(row)}
                        title="Releases the hold. Costs nothing - no charge was ever made, so there is no Stripe fee to lose."
                      >
                        Release (free)
                      </button>
                    </>
                  )}
                  {row.status !== "paid" &&
                    row.status !== "authorized" &&
                    row.status !== "refunded_partial" &&
                    row.status !== "refunded_full" && (
                      <button
                        type="button"
                        className={styles.refundBtnGhost}
                        disabled={busyId === row.id}
                        onClick={() => remove(row)}
                      >
                        Delete
                      </button>
                    )}
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
}
