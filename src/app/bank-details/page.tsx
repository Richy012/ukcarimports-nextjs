import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

// Ported from the legacy SPA (BankDetails.jsx) so the route survives cutover.
// It is linked from the deposit-request email, and the balance on every
// purchase is settled by bank transfer, so this page cannot 404.
export const metadata: Metadata = {
  title: "Bank Transfer Details",
  description:
    "Bank transfer details for paying your UK Car Imports deposit or balance.",
};

const ROWS: { label: string; value: string; mono?: boolean }[] = [
  { label: "Account name", value: "Focus Investments Ltd t/a UK CAR IMPORTS" },
  { label: "Bank name", value: "Bank of Ireland" },
  { label: "Bank address (branch)", value: "Sutton Cross" },
  { label: "IBAN", value: "IE36BOFI90069043317227", mono: true },
  { label: "Bank identifier (BIC)", value: "BOFIIE2D", mono: true },
];

export default function BankDetailsPage() {
  return (
    <main className={styles.page}>
      <h1>Bank transfer details</h1>

      <p className={styles.lead}>
        Use the details below to pay by bank transfer. Please include the{" "}
        <strong>car registration</strong> in the payment description so we can match
        your transfer quickly.
      </p>

      <div className={styles.card}>
        <table className={styles.table}>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td className={row.mono ? styles.mono : undefined}>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.note}>
        <p>
          <strong>Paying your €2,000 deposit?</strong> You can also pay it online by card,
          Apple&nbsp;Pay or Google&nbsp;Pay — open the car you want and choose{" "}
          <em>Reserve this car</em>.
        </p>
        <p>
          <strong>Paying the balance?</strong> The balance of your purchase is paid by bank
          transfer using the details above.
        </p>
      </div>

      <p className={styles.help}>
        Any questions about your payment?{" "}
        <Link href="/contact">Contact us</Link> and we&apos;ll help directly, or call{" "}
        <a href="tel:015568261">01-556 8261</a>.
      </p>
    </main>
  );
}
