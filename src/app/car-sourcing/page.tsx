import type { Metadata } from "next";
import CarSourcingForm from "./CarSourcingForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Car Sourcing",
  description: "Found a vehicle in the UK you'd like to import? We calculate the total landed price for you.",
};

export default function CarSourcingPage() {
  return (
    <main className={styles.page}>
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
          <li>VRT including NOx and CO2 elements</li>
          <li>Rules of Origin Duty if applicable</li>
        </ul>
        <p>We will then forward you a total price to have the car imported.</p>
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

      <CarSourcingForm />

      <div className={styles.stripeFooter}>
        <img
          src="https://ukcarimports.ie/assets/images/srtipe_payments.png"
          alt="Stripe payment"
          width={1000}
          height={184}
        />
      </div>
    </main>
  );
}
