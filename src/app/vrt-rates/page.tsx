import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

// Reference table the owner can point customers and social posts at
// (owner request, 2026-08-26). The band data is the SAME `car_vrt_rate`
// table the pricing engine reads for every car on the site, copied here
// verbatim -- if Revenue changes the bands, update the DB table AND this
// page together.
export const metadata: Metadata = {
  title: "VRT Rates in Ireland by CO₂ Band",
  description:
    "The full Irish VRT table for 2026: all 20 CO₂ bands and VRT percentages, plus the NOx levy and the NEDC-to-WLTP uplift formulas.",
};

// Percentages match production's car_vrt_rate table, verified against
// revenue.ie/en/vrt/calculating-vrt/applying-tax.aspx on 2026-08-26.
// Minimum-VRT amounts deliberately not shown (owner, 2026-08-26).
const BANDS: { band: string; co2: string; rate: string }[] = [
  { band: "1", co2: "0 – 50", rate: "7%" },
  { band: "2", co2: "51 – 80", rate: "9%" },
  { band: "3", co2: "81 – 85", rate: "9.75%" },
  { band: "4", co2: "86 – 90", rate: "10.5%" },
  { band: "5", co2: "91 – 95", rate: "11.25%" },
  { band: "6", co2: "96 – 100", rate: "12%" },
  { band: "7", co2: "101 – 105", rate: "12.75%" },
  { band: "8", co2: "106 – 110", rate: "13.5%" },
  { band: "9", co2: "111 – 115", rate: "15.25%" },
  { band: "10", co2: "116 – 120", rate: "16%" },
  { band: "11", co2: "121 – 125", rate: "16.75%" },
  { band: "12", co2: "126 – 130", rate: "17.5%" },
  { band: "13", co2: "131 – 135", rate: "19.25%" },
  { band: "14", co2: "136 – 140", rate: "20%" },
  { band: "15", co2: "141 – 145", rate: "21.5%" },
  { band: "16", co2: "146 – 150", rate: "25%" },
  { band: "17", co2: "151 – 155", rate: "27.5%" },
  { band: "18", co2: "156 – 170", rate: "30%" },
  { band: "19", co2: "171 – 190", rate: "35%" },
  { band: "20", co2: "191 and over", rate: "41%" },
];

export default function VrtRatesPage() {
  return (
    <main className={styles.page}>
      <h1>VRT rates in Ireland by CO₂ band</h1>

      <p className={styles.lead}>
        Vehicle Registration Tax on a passenger car (Category A) is a percentage of the
        car&apos;s <strong>Open Market Selling Price (OMSP)</strong> — the Irish market value
        Revenue assigns to the car, not the price you paid for it in the UK. The percentage
        is set by the car&apos;s <strong>WLTP CO₂ figure</strong> using the bands below. The
        table is current for <strong>2026</strong> — the bands have been unchanged since
        January 2022 — and it is the same table our pricing engine applies to every car on
        the site.
      </p>

      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Band</th>
              <th scope="col">CO₂ (g/km, WLTP)</th>
              <th scope="col" className={styles.num}>VRT rate</th>
            </tr>
          </thead>
          <tbody>
            {BANDS.map((b) => (
              <tr key={b.band}>
                <td>{b.band}</td>
                <td>{b.co2}</td>
                <td className={styles.num}>{b.rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Older cars tested under NEDC</h2>
      <p className={styles.lead}>
        Cars first tested under the older NEDC emissions cycle (broadly, pre-September 2018)
        don&apos;t have a WLTP figure, so Revenue uplifts the NEDC value to a WLTP equivalent
        before applying the bands: <strong>petrol</strong> NEDC × 0.9227 + 34.554, and{" "}
        <strong>diesel</strong> NEDC × 1.1405 + 12.858. For example, a petrol car recorded at
        110&nbsp;g/km NEDC uplifts to 136&nbsp;g/km, which falls in band 14 at 20%.
      </p>

      <h2>The NOx levy</h2>
      <p className={styles.lead}>
        On top of the CO₂-based charge, a NOx levy is added per mg/km of nitrogen oxide
        emissions: <strong>€5</strong> per mg/km for the first 40, <strong>€15</strong> per
        mg/km from 41 to 80, and <strong>€25</strong> per mg/km above 80. Where satisfactory
        evidence of a car&apos;s NOx emissions cannot be produced, Revenue charges the
        maximum instead: <strong>€4,850</strong> for diesel, <strong>€600</strong> for all
        other vehicles.
      </p>

      <div className={styles.note}>
        <p>
          <strong>You never need to work this out yourself on our cars.</strong> Every price
          on the site is all-in — the exact VRT for that car, the NOx levy, VAT, customs duty
          and transport are already included in the figure you see.
        </p>
        <p>
          Verified against Revenue&apos;s published tables on 26 August 2026, and re-checked
          monthly. Official sources:{" "}
          <a
            href="https://www.revenue.ie/en/vrt/calculating-vrt/applying-tax.aspx"
            target="_blank"
            rel="noreferrer"
          >
            Revenue — calculating VRT
          </a>
          ,{" "}
          <a
            href="https://www.revenue.ie/en/vrt/calculating-vrt/calculating-nox-charge.aspx"
            target="_blank"
            rel="noreferrer"
          >
            Revenue — the NOx charge
          </a>{" "}
          and the{" "}
          <a
            href="https://www.ros.ie/evrt-enquiry/vrtenquiry.html"
            target="_blank"
            rel="noreferrer"
          >
            official ROS VRT enquiry tool
          </a>
          .
        </p>
      </div>

      <p className={styles.help}>
        <Link href="/used-cars">Browse the cars</Link> — or see{" "}
        <Link href="/how-it-works">how the import process works</Link>.
      </p>
    </main>
  );
}
