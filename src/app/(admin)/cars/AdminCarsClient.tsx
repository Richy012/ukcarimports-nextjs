"use client";

import { useEffect, useState } from "react";
import { staffAuthHeaders } from "@/lib/auth";
import EmailModal from "./EmailModal";
import styles from "./page.module.css";

const EMAIL_TEMPLATES = [
  { key: "deposit_reply", label: "Deposit reply" },
  { key: "invoice", label: "Invoice" },
  { key: "inspection_report", label: "Inspection report" },
  { key: "vrt_documents", label: "VRT documents" },
  { key: "new_registration", label: "New registration" },
];

interface CarRow {
  car_id: string;
  make_name?: string;
  make?: string;
  model_name?: string;
  model?: string;
  version?: string;
  trim?: string;
  car_year?: string;
  year?: string;
  mileage?: string;
  price?: string;
  has_valid_vrt?: number | string;
  featured_image?: string;
  auction_company_name?: string;
  parent_created_at?: string;
  car_info?: {
    final_price?: number;
    before_vrt_final_price?: number;
    vrt_pending?: boolean;
    vrt_rate?: number | null;
  };
}

interface PriceHistoryRow {
  old_price: string | null;
  new_price: string | null;
  changed_at: string;
}

interface CarDetail {
  breakdown: {
    vat_free_eur: number;
    pre_duty_base: number;
    duty_applied: boolean;
    after_irish_vat: number;
    shipping_fee: number;
    customs_agent_fee: number;
    service_fee: number;
    mechanical_inspection_fee: number;
    vrt_rate: number;
    vrt_pending: boolean;
    total_price: number;
    total_price_before_vrt: number;
  };
  vrt_statcode: string | null;
  vrt_omsp: string | null;
  nox_value: number | null;
  nox_source: "statcode" | "scraped" | null;
  exchange_rate: number | null;
  raw_price_gbp: string | null;
  auction_company_name: string | null;
  car_url: string | null;
  created_at: string | null;
  price_frozen: boolean;
  price_history: PriceHistoryRow[];
}

const LIMIT = 25;

function eur(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  return `€${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function gbp(n: string | number | null | undefined): string {
  if (n === null || n === undefined || n === "") return "-";
  return `£${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function vrtBadge(car: CarRow) {
  const pending = car.car_info?.vrt_pending;
  const hasVrt = Number(car.has_valid_vrt) === 1;
  if (pending || !hasVrt) {
    return <span className={styles.badgePending}>Pending</span>;
  }
  return <span className={styles.badgeMatch}>Match</span>;
}

export default function AdminCarsClient() {
  const [cars, setCars] = useState<CarRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [vrtFilter, setVrtFilter] = useState<"All" | "Yes" | "No">("All");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, CarDetail>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/staff-cars", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...staffAuthHeaders() },
      body: JSON.stringify({ pagenum: page, limit: LIMIT, vrt: vrtFilter }),
    })
      .then((res) => res.json())
      .then((data) => {
        setCars(data?.data?.cars ?? []);
        setCount(data?.data?.count ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page, vrtFilter]);

  function toggleExpand(carId: string) {
    if (expandedId === carId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(carId);
    if (!details[carId]) {
      setDetailLoading(carId);
      fetch(`/api/staff-car-detail/${carId}`, { headers: staffAuthHeaders() })
        .then((res) => res.json())
        .then((data) => {
          if (data?.data) {
            setDetails((prev) => ({ ...prev, [carId]: data.data }));
          }
        })
        .finally(() => setDetailLoading(null));
    }
  }

  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [emailModal, setEmailModal] = useState<{ carId: string; templateKey: string } | null>(null);

  function toggleFreeze(carId: string) {
    setActionBusy(carId);
    fetch(`/api/staff-car-freeze/${carId}`, { method: "POST", headers: staffAuthHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ResponseCode == 1) {
          setDetails((prev) => ({
            ...prev,
            [carId]: { ...prev[carId], price_frozen: !!data.frozen },
          }));
        } else if (data?.ResponseText) {
          alert(data.ResponseText);
        }
      })
      .finally(() => setActionBusy(null));
  }

  function markSold(carId: string, carName: string) {
    if (!window.confirm(`Mark "${carName}" as SOLD?\n\nThis removes the car from the live site immediately.`)) {
      return;
    }
    setActionBusy(carId);
    fetch(`/api/staff-car-sold/${carId}`, { method: "POST", headers: staffAuthHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ResponseCode == 1) {
          setCars((prev) => prev.filter((c) => c.car_id !== carId));
          setCount((prev) => Math.max(0, prev - 1));
          setExpandedId(null);
        } else if (data?.ResponseText) {
          alert(data.ResponseText);
        }
      })
      .finally(() => setActionBusy(null));
  }

  const totalPages = Math.max(1, Math.ceil(count / LIMIT));

  return (
    <>
      <div className={styles.headerRow}>
        <h1 className={styles.heading}>Cars</h1>
        <div className={styles.filterRow}>
          <label>
            VRT:{" "}
            <select
              value={vrtFilter}
              onChange={(e) => {
                setPage(0);
                setVrtFilter(e.target.value as "All" | "Yes" | "No");
              }}
            >
              <option value="All">All</option>
              <option value="Yes">Has VRT</option>
              <option value="No">No VRT</option>
            </select>
          </label>
          <span className={styles.countText}>{count.toLocaleString()} cars</span>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.tableHead}>
          <span>Car</span>
          <span>Mileage</span>
          <span>Price (GBP)</span>
          <span>Price (EUR)</span>
          <span>VRT</span>
          <span></span>
        </div>

        {loading ? (
          <p className={styles.loadingText}>Loading...</p>
        ) : (
          cars.map((car) => {
            const isOpen = expandedId === car.car_id;
            const detail = details[car.car_id];
            return (
              <div key={car.car_id}>
                <div className={styles.tableRow} onClick={() => toggleExpand(car.car_id)}>
                  <span className={styles.carCell}>
                    <strong>
                      {car.make_name || car.make} {car.model_name || car.model}
                    </strong>
                    <span className={styles.carSub}>
                      {[car.version, car.trim].filter(Boolean).join(" / ")} &middot; {car.car_year || car.year}
                    </span>
                  </span>
                  <span>{car.mileage} km</span>
                  <span>{gbp(car.price)}</span>
                  <span>{eur(car.car_info?.final_price)}</span>
                  <span>{vrtBadge(car)}</span>
                  <span className={styles.chevron}>{isOpen ? "▴" : "▾"}</span>
                </div>

                {isOpen && (
                  <div className={styles.detailPanel}>
                    {detailLoading === car.car_id && <p>Loading breakdown...</p>}
                    {detail && (
                      <>
                        <div className={styles.detailGrid}>
                          <div>
                            <p className={styles.detailLabel}>Base calculation</p>
                            <div className={styles.detailRows}>
                              <span>
                                <span>VAT-free (GBP&rarr;EUR)</span>
                                <span>{eur(detail.breakdown.vat_free_eur)}</span>
                              </span>
                              <span>
                                <span>+ Shipping</span>
                                <span>{eur(350)}</span>
                              </span>
                              <span>
                                <span>Duty applied</span>
                                <span>{detail.breakdown.duty_applied ? "Yes, 10%" : "No"}</span>
                              </span>
                              <span>
                                <span>Exchange rate</span>
                                <span>{detail.exchange_rate ?? "-"}</span>
                              </span>
                              <span>
                                <span>Sterling price</span>
                                <span>
                                  {gbp(detail.raw_price_gbp)}
                                  {detail.auction_company_name ? ` – ${detail.auction_company_name}` : ""}
                                </span>
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className={styles.detailLabel}>Fees</p>
                            <div className={styles.detailRows}>
                              <span>
                                <span>Customs agent</span>
                                <span>{eur(detail.breakdown.customs_agent_fee)}</span>
                              </span>
                              <span>
                                <span>Service fee</span>
                                <span>{eur(detail.breakdown.service_fee)}</span>
                              </span>
                              <span>
                                <span>Mech. inspection</span>
                                <span>{eur(detail.breakdown.mechanical_inspection_fee)}</span>
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className={styles.detailLabel}>VRT match</p>
                            <div className={styles.detailRows}>
                              <span>
                                <span>Statcode</span>
                                <span>{detail.vrt_statcode ?? "No match"}</span>
                              </span>
                              <span>
                                <span>OMSP</span>
                                <span>{detail.vrt_omsp ? eur(Number(detail.vrt_omsp)) : "-"}</span>
                              </span>
                              <span>
                                <span>VRT rate</span>
                                <span>{eur(detail.breakdown.vrt_rate)}</span>
                              </span>
                              <span>
                                <span>NOx</span>
                                <span>
                                  {detail.nox_value !== null
                                    ? `${detail.nox_value} (${detail.nox_source})`
                                    : "No NOx data"}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className={styles.totalsRow}>
                          <span>
                            Added <strong>{detail.created_at ?? "-"}</strong>
                          </span>
                          <span>
                            Before VRT <strong>{eur(detail.breakdown.total_price_before_vrt)}</strong>
                          </span>
                          <span>
                            Total <strong className={styles.totalValue}>{eur(detail.breakdown.total_price)}</strong>
                          </span>
                        </div>

                        <p className={styles.urlNote}>
                          Source URL not captured in scraped data (car_url stores only the internal car_id).
                        </p>

                        {detail.price_history.length > 0 && (
                          <div className={styles.historyBlock}>
                            <p className={styles.detailLabel}>Price history</p>
                            {detail.price_history.map((h, i) => (
                              <span key={i} className={styles.historyRow}>
                                {h.changed_at}: {eur(Number(h.old_price))} &rarr; {eur(Number(h.new_price))}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className={styles.actionsRow}>
                          <button
                            type="button"
                            className={detail.price_frozen ? styles.actionBtnActive : styles.actionBtn}
                            disabled={actionBusy === car.car_id}
                            onClick={() => toggleFreeze(car.car_id)}
                          >
                            {detail.price_frozen ? "🔒 Price frozen — click to unfreeze" : "Freeze price (save advert)"}
                          </button>
                          <button
                            type="button"
                            className={styles.actionBtnDanger}
                            disabled={actionBusy === car.car_id}
                            onClick={() => markSold(car.car_id, `${car.make_name || car.make} ${car.model_name || car.model}`)}
                          >
                            Mark sold — remove from site
                          </button>
                        </div>

                        <div className={styles.emailBtnRow}>
                          <span className={styles.detailLabel}>Generate email:</span>
                          {EMAIL_TEMPLATES.map((tpl) => (
                            <button
                              key={tpl.key}
                              type="button"
                              className={styles.emailBtn}
                              onClick={() => setEmailModal({ carId: car.car_id, templateKey: tpl.key })}
                            >
                              {tpl.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className={styles.pagination}>
        <button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          Previous
        </button>
        <span>
          Page {page + 1} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page + 1 >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>

      {emailModal && (
        <EmailModal
          carId={emailModal.carId}
          templateKey={emailModal.templateKey}
          onClose={() => setEmailModal(null)}
        />
      )}
    </>
  );
}
