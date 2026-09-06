import type { Metadata } from "next";
import Link from "next/link";
import { BadgeEuro, ShieldCheck, Handshake, Camera, Clock3, CarFront } from "lucide-react";
import { irishCount } from "@/lib/irishListings";

/**
 * The SEO landing page for the trade-in / sell-my-car function. STAGING.
 *
 * Owner, 6 Sep: "create some SEO vehicle like we did with Jaecoo to get the
 * trade in function ranked." Same pattern as /import/[make]: one strong H1,
 * a plain answer to the searcher's question in the first paragraph, an
 * on-page FAQ mirrored in FAQPage JSON-LD, breadcrumbs, internal links both
 * ways, and a canonical. Targets: "sell my car Ireland", "trade in my car
 * Ireland", "trade in value Ireland", "sell car privately Ireland",
 * "what is my car worth Ireland".
 *
 * Every figure claimed here is one we measure (see WORKLOG 4–6 Sep); nothing
 * is a marketing invention. Copy passes the owner before it goes live.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sell My Car Ireland — Trade-In Value in 10 Seconds, or Sell Privately, Protected",
  description:
    "Find out what your car is worth in Ireland in ten seconds — measured from real Irish sales, not a guess. Trade it in against a UK import, or sell it privately with an inspection, a warranty and protected payment behind you.",
  alternates: { canonical: "https://ukcarimports.ie/sell-my-car" },
  keywords: ["sell my car Ireland", "trade in my car Ireland", "trade in value Ireland", "car valuation Ireland", "sell car privately Ireland", "what is my car worth"],
};

const FAQ = [
  { q: "How do you know what my car is worth?",
    a: "Two ways, and we show you both. For a trade-in, we use what cars like yours — same make, model, year and mileage — actually sold for at Irish trade auctions, measured on over 2,000 real sales. For a private sale, we use what comparable private ads in Ireland were priced at when they actually sold. Both are ranges, not single figures, because no two cars sell for the same money." },
  { q: "Is the figure an offer?",
    a: "No. It is a measured range you can see in ten seconds, before you give us anything but the reg and the mileage. If you want to trade the car in, a person goes through your photos and answers and comes back with a firm figure — usually the same working day. Nothing is committed until you accept it." },
  { q: "Can I trade in my car if I'm buying a UK import from you?",
    a: "Yes — that is what the trade-in route is for. Your car's value is credited against the all-in price of the import, on delivery day, and you keep driving it until then. One handover, one appointment." },
  { q: "What is Above Board Cars?",
    a: "Selling privately gets you more money but carries the risk of a private sale — strangers, payment, comebacks. Above Board Cars puts an independent mechanical inspection, an industry-standard warranty and a protected, escrow-style payment behind your private sale, and advertises your car on ukcarimports.ie as well as letting you list it on DoneDeal. Buyers deal with us, not you." },
  { q: "Do I need to sign up?",
    a: "No sign-up, no obligation and nothing to pay to see the range. If you have not got everything to hand, we can email you a link to finish later on any device." },
  { q: "What do you need from me?",
    a: "The reg and the mileage to show you the range. To make a firm offer we need the guided photos of the car, the condition and service-history questions answered, and — before completion — a photo of the VRC and ID. We never make an offer on a car we have not seen." },
  { q: "I need finance for the import — does that change things?",
    a: "Bank finance (AIB, Bank of Ireland, PTSB) works with an import through us. Finance houses will not finance a car bought this way, so if you need a finance house the whole deal — your import and your trade-in — goes to one of our partner dealers, who can arrange it." },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://ukcarimports.ie/" },
      { "@type": "ListItem", position: 2, name: "Sell my car", item: "https://ukcarimports.ie/sell-my-car" },
    ] },
    { "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    { "@type": "Service", name: "Car trade-in and private sale in Ireland", provider: { "@type": "Organization", name: "UK Car Imports", url: "https://ukcarimports.ie" },
      areaServed: "IE", description: "Measured trade-in and private-sale valuations for cars in Ireland; trade in against a UK import or sell privately with Above Board Cars protection." },
  ],
};

export default async function SellMyCarPage() {
  const n = await irishCount();
  return (
    <main style={S.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav style={S.crumb} aria-label="Breadcrumb"><Link href="/">Home</Link> <span>/</span> <span>Sell my car</span></nav>

      <h1 style={S.h1}>Sell your car in Ireland &mdash; know what it is worth in ten seconds</h1>
      <p style={S.intro}>
        Type the reg and the mileage and we show you two ranges for your car, measured from real Irish
        sales: what you would get <b>trading it in against a UK import</b>, and what you could
        expect <b>selling it privately</b> with our protection behind you. No sign-up, no obligation,
        and no single made-up figure &mdash; a range, because no two cars sell for the same money.
      </p>
      <p><Link href="/trade-ins" style={S.cta}>Get my car&rsquo;s range &rarr;</Link></p>

      <div style={S.grid}>
        <div style={S.card}><BadgeEuro size={22} style={S.ico} /><b>Measured, not guessed</b><p style={S.p}>The trade-in range comes from over 2,000 real Irish trade sales of cars at your mileage and age. The private range from what comparable private ads were priced at when they actually sold.</p></div>
        <div style={S.card}><Clock3 size={22} style={S.ico} /><b>Ten seconds, two numbers</b><p style={S.p}>Reg and mileage. That is all we need to show you both ranges. Everything else comes after you have seen them.</p></div>
        <div style={S.card}><Camera size={22} style={S.ico} /><b>Photos do the negotiating</b><p style={S.p}>Guided photos and a short condition record travel with the car. What a buyer has already seen, he cannot use to cut the price on the day.</p></div>
        <div style={S.card}><Handshake size={22} style={S.ico} /><b>Trade it in against an import</b><p style={S.p}>Certain today, credited off your import on delivery day. You keep driving your car until then.</p></div>
        <div style={S.card}><ShieldCheck size={22} style={S.ico} /><b>Or sell privately, protected</b><p style={S.p}>More money, and Above Board Cars behind it: independent inspection, industry-standard warranty, protected payment. Buyers deal with us, not you. <Link href="/trade-ins/above-board-cars" style={S.more}>How Above Board Cars works &rarr;</Link></p></div>
        <div style={S.card}><CarFront size={22} style={S.ico} /><b>Your car, advertised here</b><p style={S.p}>Your car is listed on ukcarimports.ie under Above Board Cars{n > 0 ? ` alongside ${n} other Irish-registered car${n === 1 ? "" : "s"}` : ""}, and you can list it on DoneDeal too.</p></div>
      </div>

      <h2 style={S.h2}>How it works</h2>
      <ol style={S.ol}>
        <li>The reg and the mileage &mdash; we show you a range for each way of selling.</li>
        <li>Pick how you want to sell, with both ranges in front of you.</li>
        <li>Spec, guided photographs and the condition questions &mdash; about five minutes. Save and finish later if you need to.</li>
        <li>Trading in: a person confirms the firm figure, usually the same working day. Selling privately: your car goes live with Above Board Cars behind it, priced by you within the range.</li>
      </ol>

      <h2 style={S.h2}>Questions people ask</h2>
      {FAQ.map((f) => (
        <details key={f.q} style={S.faq}><summary style={S.q}>{f.q}</summary><p style={S.a}>{f.a}</p></details>
      ))}

      <p style={{ marginTop: 24 }}><Link href="/trade-ins" style={S.cta}>Get my car&rsquo;s range &rarr;</Link></p>
      <p style={S.links}>
        See also: <Link href="/irish-cars">Irish registered cars for sale</Link> · <Link href="/how-it-works">How importing works</Link> · <Link href="/used-cars">UK cars priced for Ireland</Link>
      </p>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 960, margin: "0 auto", padding: "20px 16px 60px", lineHeight: 1.55 },
  crumb: { fontSize: 13, color: "#64748b", marginBottom: 10 },
  h1: { fontSize: 32, lineHeight: 1.15, margin: "0 0 10px" },
  intro: { fontSize: 16.5, color: "#333", maxWidth: 780 },
  cta: { display: "inline-block", padding: "12px 20px", background: "#b60b0c", color: "#fff", borderRadius: 10, fontWeight: 700, textDecoration: "none" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, margin: "18px 0 8px" },
  card: { border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 16px", background: "#fff" },
  ico: { color: "#b60b0c", marginBottom: 6, display: "block" },
  p: { margin: "4px 0 0", fontSize: 14, color: "#475569" },
  h2: { fontSize: 22, margin: "26px 0 8px" },
  ol: { paddingLeft: 20, fontSize: 15 },
  faq: { border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", margin: "0 0 8px", background: "#fff" },
  q: { fontWeight: 700, cursor: "pointer", fontSize: 15 },
  a: { margin: "8px 0 0", fontSize: 14.5, color: "#333" },
  links: { fontSize: 14, color: "#475569", marginTop: 12 },
  more: { color: "#b60b0c", fontWeight: 700, textDecoration: "underline", whiteSpace: "nowrap" },
};
