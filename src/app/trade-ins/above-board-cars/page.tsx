import DraftBanner from "@/app/components/DraftBanner";
import type { Metadata } from "next";
import Link from "next/link";
import { PUNCH_LINE, ESCROW_FEE_EUR, INSPECTION_FEE_EUR, WARRANTIES, WARRANTY_DOC_BASE } from "@/lib/aboveBoard";
import CopyLine from "../../above-board-cars/CopyLine";

/**
 * /trade-ins/above-board-cars — THE CUSTOMER'S PAGE. STAGING, unlinked until the owner
 * has seen it (6 Sep: "build the customer page - let me see it first").
 *
 * The reader is OUR customer: buying an import from us and selling their own car
 * privately. It sells them the route — the bigger number, a garage's protection
 * behind their private sale, what it costs, the warranties, and the line for their
 * ad. The page a BUYER of their car is sent to by that line is
 * /above-board-cars, and stays aimed at the buyer.
 *
 * Owner's rules for this copy: sell it; never explain it through "risk".
 */
export const metadata: Metadata = {
  title: "Above Board Cars — sell your car privately for the bigger number, with a garage's protection behind you",
  description:
    "Keep your car, set your price and sell it privately for more than any trade will pay. Above Board Cars gives your buyer an independent inspection, a 12-month warranty and protected payment through Stripe.",
  alternates: { canonical: "https://ukcarimports.ie/trade-ins/above-board-cars" },
  openGraph: { type: "website", url: "https://ukcarimports.ie/trade-ins/above-board-cars", siteName: "UK Car Imports", locale: "en_IE", title: "Above Board Cars — sell your car privately for the bigger number, with a garage's protection behind you", description: "Keep your car, set your price and sell it privately for more than any trade will pay, with an inspection, a 12-month warranty and protected payment behind the sale.",
    images: [{ url: "https://ukcarimports.ie/assets/images/hero-rot-nocosts.jpg", width: 1672, height: 941, alt: "UK Car Imports" }] },
  twitter: { card: "summary_large_image", title: "Above Board Cars — sell your car privately for the bigger number, with a garage's protection behind you", description: "Keep your car, set your price and sell it privately for more than any trade will pay, with an inspection, a 12-month warranty and protected payment behind the sale.", images: ["https://ukcarimports.ie/assets/images/hero-rot-nocosts.jpg"] },
};

const eur = (n: number) => "€" + n.toLocaleString("en-IE");

const YOU_GET = [
  ["More money than a trade-in", "Private sales pay more than any trade. You keep the car, you set the price, you keep the difference."],
  ["More buyers, a better price, a quicker sale", "Buyers want a private-sale price but are wary of a private seller. Give them the protection a garage gives, and your ad pulls the buyers a garage’s ad does."],
  ["Their money is protected", "The buyer pays into Stripe’s escrow-like transfer account and it is released to you at handover. They know their money is safe; you know the money is real — and a buyer who has paid in is not a messer."],
  ["An independent inspection, if they want one", "A buyer can have the car independently inspected through us, or bring their own mechanic. Either way, the car speaks for itself."],
  ["A 12-month warranty on the car", "A private buyer has no comeback on a private seller — the warranty is what gives them one. Garage-level cover, on your private sale."],
  ["Advertised where people are already looking", "Your car goes on ukcarimports.ie, and you list it on DoneDeal too with our line in the ad."],
];

const STEPS = [
  ["Reg and mileage", "Ten seconds. We show you what comparable cars actually sold for privately, and what a trade would pay, side by side."],
  ["Photos and the condition questions", "About five minutes on your phone. Save and finish later if you have not got everything to hand."],
  ["We check the paperwork and your car goes live", "Registration certificate and ID checked, then your car is advertised on ukcarimports.ie at the price you set."],
  ["Put our line in your own ad", "Copy the line below into your DoneDeal advert. It tells every buyer the sale is protected."],
  ["We handle the buyer", "Enquiries come through us. We arrange the independent inspection if the buyer wants one, put the warranty on the car and hold the buyer’s payment in the protected account."],
  ["Handover, and the money is released to you", "You hand over the car and the keys; the payment is released the same day."],
];

export default function AboveBoardCarsCustomerPage() {
  return (
    <main style={S.page}>
      <DraftBanner style={S.banner}>WORKING DRAFT — staging. Nothing here is agreed.</DraftBanner>

      <div style={S.brand}>Above Board Cars</div>
      <p style={S.punch}>{PUNCH_LINE}</p>

      <h1 style={S.h1}>Sell your car privately for the bigger number &mdash; with a garage&rsquo;s protection behind you</h1>
      <p style={S.lede}>
        You keep the car, you set the price, and you sell it to a private buyer for more than any
        trade will pay. Above Board Cars gives that buyer everything a garage would &mdash; an
        independent inspection, a 12-month warranty and protected payment &mdash; so they pay a
        garage price for a private car, and you take the difference.
      </p>
      <p>
        <Link href="/trade-ins" style={S.cta}>See what your car is worth &rarr;</Link>
        <span style={S.ctaNote}>Reg and mileage. No sign-up, no obligation.</span>
      </p>

      <h2 style={S.h2}>What you get</h2>
      <div style={S.grid}>
        {YOU_GET.map(([h, b]) => (
          <div key={h} style={S.card}>
            <b style={S.cardT}>{h}</b>
            <p style={S.cardB}>{b}</p>
          </div>
        ))}
      </div>

      <h2 style={S.h2}>How it works for you</h2>
      {STEPS.map(([h, b], i) => (
        <div key={h} style={S.step}>
          <div style={S.stepN}>{i + 1}</div>
          <div>
            <div style={S.stepHead}>{h}</div>
            <p style={S.stepBody}>{b}</p>
          </div>
        </div>
      ))}

      <h2 style={S.h2}>What it costs</h2>
      <div style={S.costs}>
        <ul style={S.ul}>
          <li>Payment protection through Stripe&rsquo;s escrow-like transfer account: <b>{eur(ESCROW_FEE_EUR)}</b> per sale.</li>
          <li>Independent mechanical inspection: <b>{eur(INSPECTION_FEE_EUR.low)}&ndash;{INSPECTION_FEE_EUR.high}</b>, depending on where the car is and how detailed a check you want.</li>
          <li>12-month warranty: <b>{eur(395)}&ndash;495</b> by level of cover &mdash; the five covers are below, each with its full policy document.</li>
          <li>Typically sellers will include all 3 services to attract more interest and help achieve a better price and a quicker sale.</li>
        </ul>
        <div style={S.subHead}>12-month warranties</div>
        <ul style={S.ul}>
          {WARRANTIES.map((w) => (
            <li key={w.doc}>
              {w.label} &mdash; {eur(w.price)}{" "}
              <a href={`${WARRANTY_DOC_BASE}${w.doc}.pdf`} target="_blank" rel="noreferrer" style={S.link}>full cover details (PDF)</a>
            </li>
          ))}
        </ul>
      </div>

      <h2 style={S.h2}>Tell all your potential buyers on DoneDeal about the garage-like protection Above Board Cars offers</h2>
      <p style={S.body}>Put this line in your ad. Every buyer who reads it knows the sale is protected, and the link explains it to them.</p>
      <CopyLine />
      <p style={{ ...S.body, fontSize: 13, color: "#64748b" }}>
        A buyer who wants the detail can be sent to <Link href="/above-board-cars" style={S.link}>ukcarimports.ie/above-board-cars</Link>.
      </p>

      <p style={{ marginTop: 26 }}>
        <Link href="/trade-ins" style={S.cta}>See what your car is worth &rarr;</Link>
      </p>

      <p style={S.foot}>
        Above Board Cars is run by ukcarimports.ie. We never own your car and we never set its price
        &mdash; you stay the seller named on the registration certificate.
      </p>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 820, margin: "0 auto", padding: "22px 16px 60px", color: "#1a1a1a", lineHeight: 1.55 },
  banner: { background: "#fff8e6", border: "1px solid #f0dfae", color: "#9a6a00", fontSize: 11.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", padding: "7px 12px", borderRadius: 6, marginBottom: 18 },
  brand: { fontSize: 12.5, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "#b60b0c", margin: "0 0 2px" },
  punch: { fontSize: 22, fontWeight: 700, fontStyle: "italic", color: "#111", margin: "0 0 18px", letterSpacing: "-.3px" },
  h1: { fontSize: 30, lineHeight: 1.15, margin: "0 0 12px", letterSpacing: "-.6px" },
  lede: { fontSize: 16, color: "#333", margin: "0 0 16px", maxWidth: 720 },
  cta: { display: "inline-block", padding: "12px 20px", background: "#b60b0c", color: "#fff", borderRadius: 10, fontWeight: 700, textDecoration: "none" },
  ctaNote: { marginLeft: 12, fontSize: 13, color: "#64748b" },
  h2: { fontSize: 21, margin: "28px 0 10px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 },
  card: { border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", background: "#fff" },
  cardT: { display: "block", fontSize: 15, marginBottom: 4 },
  cardB: { margin: 0, fontSize: 14, color: "#475569" },
  step: { display: "flex", gap: 12, margin: "0 0 12px" },
  stepN: { flex: "0 0 28px", height: 28, borderRadius: 14, background: "#1a1a1a", color: "#fff", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2 },
  stepHead: { fontWeight: 700, fontSize: 15.5 },
  stepBody: { margin: "2px 0 0", fontSize: 14, color: "#475569" },
  costs: { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 16px" },
  ul: { margin: 0, paddingLeft: 18, fontSize: 14.5, color: "#334155", lineHeight: 1.6 },
  subHead: { fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "#334155", margin: "12px 0 4px", paddingTop: 10, borderTop: "1px solid #e2e8f0" },
  link: { color: "#b60b0c", textDecoration: "underline" },
  body: { fontSize: 15, color: "#333", margin: "0 0 10px" },
  foot: { fontSize: 13, color: "#64748b", marginTop: 26, borderTop: "1px solid #e2e8f0", paddingTop: 12 },
};
