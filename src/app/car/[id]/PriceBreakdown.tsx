"use client";

import { useState } from "react";
import styles from "./page.module.css";

interface CarInfo {
  converted_price: number;
  shipping_fee: number;
  customs_agent_fee: number;
  after_irish_vat: number;
  fee: number;
  final_price: number;
  duty_applied: boolean;
  mechanical_inspection_fee: number;
  warranty_premium_max_eligible: boolean;
  warranty_premium_plus_eligible: boolean;
  warranty_premium_component_eligible: boolean;
  warranty_premium_powertrain_eligible: boolean;
  warranty_premium_ev_eligible: boolean;
}

function formatEuro(n: number): string {
  return new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 }).format(Math.round(n));
}

export default function PriceBreakdown({ carInfo, vrtRate }: { carInfo: CarInfo; vrtRate: number }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [includeInspection, setIncludeInspection] = useState(false);

  const hasWarrantyOption =
    carInfo.warranty_premium_max_eligible ||
    carInfo.warranty_premium_plus_eligible ||
    carInfo.warranty_premium_component_eligible ||
    carInfo.warranty_premium_powertrain_eligible ||
    carInfo.warranty_premium_ev_eligible;

  const displayedTotal = carInfo.final_price + (includeInspection ? carInfo.mechanical_inspection_fee : 0);

  return (
    <div className={styles.priceBox}>
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

      {hasWarrantyOption && (
        <div className={styles.warrantyNote}>Extended warranty cover available at checkout</div>
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
          <div className={`${styles.breakdownRow} ${styles.breakdownTotal}`}>
            <dt>Total price</dt>
            <dd>€{formatEuro(displayedTotal)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
