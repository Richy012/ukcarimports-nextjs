import type { Metadata } from "next";
import CarSourcingForm from "./CarSourcingForm";
// import SourcingCheck from "./SourcingCheck";  // hidden 2026-08-08
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Car Sourcing",
  description: "Found a vehicle in the UK you'd like to import? We calculate the total landed price for you.",
};

export default function CarSourcingPage() {
  return (
    <main className={styles.page}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/images/banner-port.jpg"
        alt="The price you see is the price you pay — every vehicle includes VRT, VAT, customs and delivery"
        className="brand-banner"
      />
      <div className={styles.info}>
        <h1 className={styles.heading}>Car Sourcing</h1>
        <p>
          <strong>Found a vehicle* in the UK you would like to import?</strong>
        </p>
        <p>
          Perhaps we can help. First we need to calculate the total price. To do this we
          charge &euro;50
        </p>
        <p>For this we will calculate</p>
        <ul>
          <li>VRT, including the NOx and CO2 elements</li>
          <li>Any customs duty due on the vehicle</li>
          <li>VAT on import</li>
          <li>A typical customs clearance fee and shipping fee</li>
        </ul>
        <p>
          We will then forward you the total price to have the car imported &mdash; and that
          price includes us managing the entire import for you, from purchase through to
          Irish plates.
        </p>
        <p>
          Just copy and paste the link for the vehicle you are after in the form below,
          complete payment and we will be back with the amount due.
        </p>
        <p>
          <strong>
            *Please be aware that we will provide our best estimate where vehicle makes are
            not present on the VRT calculator
          </strong>
        </p>
      </div>

      {/* Hidden 2026-08-08 at Richard's request. Component and its backup are
          left in place, so restoring it is uncommenting this one line. */}
      {/* <SourcingCheck /> */}

      <CarSourcingForm />

      <div className={styles.stripeFooter}>
        <img
          src="/assets/images/srtipe_payments.png"
          alt="Stripe payment"
          width={1000}
          height={184}
        />
      </div>
    </main>
  );
}
