import type { Metadata } from "next";
import Link from "next/link";
import { BadgeEuro, ShieldCheck, Handshake, Camera, Clock3, CarFront } from "lucide-react";
import { irishCount } from "@/lib/irishListings";

/**
 * The SEO landing page for the free car valuation / trade-in / sell-my-car
 * function.
 *
 * Owner, 6 Sep: "create some SEO vehicle like we did with Jaecoo to get the
 * trade in function ranked." Owner, 19 Sep: "SEO and breadcrumb the shite out
 * of it ... include 'value my car' and all other variations ... because we
 * offer a market price, a private seller price and a trade in price" — and
 * update THIS page rather than add a new one (it has the Search Console
 * history; a new address starts from zero).
 *
 * So: one page, three prices, every wording people type as an H2 with a
 * one-line answer, the same wordings in the FAQ schema, and the alias
 * addresses in next.config.ts all 301 here. Same pattern as /import/[make]:
 * one strong H1, a plain answer in the first paragraph, on-page FAQ mirrored
 * in FAQPage JSON-LD, breadcrumbs, internal links both ways, a canonical.
 *
 * Every figure claimed here is one we measure (WORKLOG 4–6 Sep, 18 Sep);
 * nothing is a marketing invention, no competitor is named, and no firm
 * figure is promised anywhere (hard rule 4 — a range, always).
 */
export const dynamic = "force-dynamic";

const TITLE = "Value My Car Ireland — Free Instant Car Valuation: Market, Private Sale and Trade-In Price";
const DESC =
  "Free instant car valuation in Ireland. Type the reg and the mileage and see three prices for your car in ten seconds: what Irish dealers are asking, what it should sell for privately, and its trade-in value — measured from real Irish sales. No sign-up, nothing to pay.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "https://ukcarimports.ie/sell-my-car" },
  keywords: [
    "value my car", "value my car Ireland", "car valuation Ireland", "free car valuation Ireland", "instant car valuation",
    "what is my car worth", "what is my car worth Ireland", "how much is my car worth", "car value calculator Ireland",
    "car value Ireland", "trade in value Ireland", "trade in my car Ireland", "part exchange value", "sell my car Ireland",
    "sell car privately Ireland", "used car valuation Ireland", "vehicle valuation Ireland",
  ],
  openGraph: { type: "website", url: "https://ukcarimports.ie/sell-my-car", siteName: "UK Car Imports", locale: "en_IE", title: TITLE, description: DESC,
    images: [{ url: "https://ukcarimports.ie/assets/images/hero-rot-nocosts.jpg", width: 1672, height: 941, alt: "UK Car Imports" }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["https://ukcarimports.ie/assets/images/hero-rot-nocosts.jpg"] },
};

// The wordings people actually type, each answered in a sentence. These are
// the H2s on the page AND the FAQ schema, so the page ranks for the phrase
// and the answer can show as a rich result.
const FAQ = [
  { q: "How do I value my car in Ireland?",
    a: "Type the reg and the mileage on our trade-in page. In about ten seconds you see three prices for your exact make, model, year and mileage: what Irish dealers are asking for cars like yours, what it should sell for privately, and its trade-in value. Free, instant, no sign-up." },
  { q: "What is my car worth?",
    a: "Three different things, depending on how you sell it. The market price is what Irish dealers are asking for the same car; the private-sale price is a little under that; the trade-in price is what a trade buyer actually pays. We show you all three so you can compare them, measured from real Irish sales rather than a guide book." },
  { q: "Is the car valuation free?",
    a: "Yes. Some sites charge for a valuation after you type the reg, or ask for make, model and year instead of a reg and estimate from other models when they have no data. Ours is free, instant, from the reg, and every figure is measured from real Irish sales of cars like yours." },
  { q: "How much is my car worth as a trade-in?",
    a: "The trade-in range is measured from over 2,000 real Irish trade sales of cars at your mileage and age. It runs from a car with no service history and faults to a perfect one, and the figure we offer against a UK import comes from within it once a person has seen your photos." },
  { q: "What is the part-exchange value of my car?",
    a: "Part exchange and trade-in are the same thing: your car's value credited against the car you are buying. The range you see is what a trade buyer would pay for it, and against a UK import from us it is credited on delivery day — you keep driving your car until then." },
  { q: "How much will I get selling my car privately?",
    a: "The private-sale range comes from what comparable private ads in Ireland were priced at when they actually sold — usually a little under the dealer asking price. We show it as an advertising range, because a private buyer settles a little under the asking price." },
  { q: "Is there a car value calculator for Ireland?",
    a: "This is one. It does not apply a percentage to a book value; it reads real Irish dealer asking prices, real private sales and real trade sales for your make, model, year and mileage, and gives you a range for each. Enter the reg and the mileage to run it." },
  { q: "Is the figure an offer?",
    a: "No. It is a measured range you can see in ten seconds, before you give us anything but the reg and the mileage. If you want to trade the car in, a person goes through your photos and answers and comes back with a firm figure — usually the same working day. Nothing is committed until you accept it." },
  { q: "Can I trade in my car if I'm buying a UK import from you?",
    a: "Yes — that is what the trade-in route is for. Your car's value is credited against the all-in price of the import, on delivery day, and you keep driving it until then. One handover, one appointment." },
  { q: "What is Above Board Cars?",
    a: "Selling privately gets you more money but carries the risk of a private sale — strangers, payment, comebacks. Above Board Cars puts an independent mechanical inspection, an industry-standard warranty and a protected, escrow-style payment behind your private sale, and advertises your car on ukcarimports.ie as well as letting you list it on DoneDeal. Buyers deal with us, not you." },
  { q: "Do I need to sign up?",
    a: "No sign-up, no obligation and nothing to pay to see the three prices. If you have not got everything to hand, we can email you a link to finish later on any device." },
  { q: "What do you need from me?",
    a: "The reg and the mileage to show you the prices. To make a firm trade-in offer we need the guided photos of the car, the condition and service-history questions answered, and — before completion — a photo of the VRC and ID. We never make an offer on a car we have not seen." },
  { q: "I need finance for the import — does that change things?",
    a: "Bank finance (AIB, Bank of Ireland, PTSB) works with an import through us. Finance houses will not finance a car bought this way, so if you need a finance house the whole deal — your import and your trade-in — goes to one of our partner dealers, who can arrange it." },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://ukcarimports.ie/" },
      { "@type": "ListItem", position: 2, name: "Value my car", item: "https://ukcarimports.ie/sell-my-car" },
    ] },
    { "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    { "@type": "Service", name: "Free instant car valuation, trade-in and private sale in Ireland",
      serviceType: "Car valuation", provider: { "@type": "Organization", name: "UK Car Imports", url: "https://ukcarimports.ie" },
      areaServed: "IE", offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", description: "Free instant valuation from the reg and mileage" },
      description: "Free instant car valuation from the reg and mileage: market price, private-sale price and trade-in price, measured from real Irish sales. Trade in against a UK import or sell privately with Above Board Cars protection." },
    { "@type": "WebApplication", name: "Car value calculator Ireland", applicationCategory: "FinanceApplication", operatingSystem: "Any",
      url: "https://ukcarimports.ie/trade-ins", offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      description: "Enter an Irish registration and mileage; get the market, private-sale and trade-in value in about ten seconds." },
  ],
};

export default async function SellMyCarPage() {
  const n = await irishCount();
  return (
    <main style={S.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav style={S.crumb} aria-label="Breadcrumb"><Link href="/">Home</Link> <span>/</span> <span>Value my car</span></nav>

      <h1 style={S.h1}>Value my car &mdash; free, instant, three prices</h1>
      <p style={S.intro}>
        Type the reg and the mileage and in about ten seconds you see <b>three prices for your car</b>, measured
        from real Irish sales: the <b>market price</b> Irish dealers are asking for cars like yours, the
        <b> private-sale price</b> you could advertise it at, and the <b>trade-in price</b> against a UK import.
        No sign-up, nothing to pay, and no single made-up figure &mdash; a range for each, because no two
        cars sell for the same money.
      </p>
      <p><Link href="/trade-ins" style={S.cta}>Value my car now &rarr;</Link></p>

      <div style={S.three}>
        <div style={S.priceCard}><div style={S.priceLbl}>Market price</div><div style={S.priceHead}>What Irish dealers are asking</div><p style={S.p}>The middle asking price of the Irish dealer adverts for your make, model and year, right now. Every other figure is a share of this one, so the three can be compared directly.</p></div>
        <div style={S.priceCard}><div style={S.priceLbl}>Private-sale price</div><div style={S.priceHead}>What to advertise it at</div><p style={S.p}>Measured from comparable private adverts in Ireland that actually sold &mdash; usually a little under the dealer price. Yours to list, with Above Board Cars protection behind it if you want it.</p></div>
        <div style={S.priceCard}><div style={S.priceLbl}>Trade-in price</div><div style={S.priceHead}>What a trade buyer pays</div><p style={S.p}>Measured from over 2,000 real Irish trade sales at your mileage and age. Credited against your UK import on delivery day; a person confirms the firm figure from your photos.</p></div>
      </div>

      <div style={S.grid}>
        <div style={S.card}><BadgeEuro size={22} style={S.ico} /><b>Measured, not guessed</b><p style={S.p}>Real Irish dealer asking prices, real private sales and real trade sales for your exact make, model, year and mileage &mdash; not a guide book, not a percentage off a list price.</p></div>
        <div style={S.card}><Clock3 size={22} style={S.ico} /><b>Ten seconds, from the reg</b><p style={S.p}>Reg and mileage. That is all we need to show you all three prices. Everything else comes after you have seen them.</p></div>
        <div style={S.card}><Camera size={22} style={S.ico} /><b>Photos do the negotiating</b><p style={S.p}>Guided photos and a short condition record travel with the car. What a buyer has already seen, he cannot use to cut the price on the day.</p></div>
        <div style={S.card}><Handshake size={22} style={S.ico} /><b>Trade it in against an import</b><p style={S.p}>Certain today, credited off your import on delivery day. You keep driving your car until then.</p></div>
        <div style={S.card}><ShieldCheck size={22} style={S.ico} /><b>Or sell privately, protected</b><p style={S.p}>More money, and Above Board Cars behind it: independent inspection, industry-standard warranty, protected payment. Buyers deal with us, not you. <Link href="/trade-ins/above-board-cars" style={S.more}>How Above Board Cars works &rarr;</Link></p></div>
        <div style={S.card}><CarFront size={22} style={S.ico} /><b>Your car, advertised here</b><p style={S.p}>Your car is listed on ukcarimports.ie under Above Board Cars{n > 0 ? ` alongside ${n} other Irish-registered car${n === 1 ? "" : "s"}` : ""}, and you can list it on DoneDeal too.</p></div>
      </div>

      <h2 style={S.h2}>How it works</h2>
      <ol style={S.ol}>
        <li>The reg and the mileage &mdash; we show you the market price, the private-sale price and the trade-in price.</li>
        <li>Pick how you want to sell, with all three in front of you.</li>
        <li>Spec, guided photographs and the condition questions &mdash; about five minutes. Save and finish later if you need to.</li>
        <li>Trading in: a person confirms the firm figure, usually the same working day. Selling privately: your car goes live with Above Board Cars behind it, priced by you within the range.</li>
      </ol>

      <h2 style={S.h2}>What is my car worth? Value my car, trade-in value, part-exchange value &mdash; the questions people ask</h2>
      {FAQ.map((f) => (
        <details key={f.q} style={S.faq}><summary style={S.q}>{f.q}</summary><p style={S.a}>{f.a}</p></details>
      ))}

      <p style={{ marginTop: 24 }}><Link href="/trade-ins" style={S.cta}>Value my car now &rarr;</Link></p>
      <p style={S.links}>
        See also: <Link href="/trade-ins">Trade in your car</Link> · <Link href="/trade-ins/above-board-cars">Sell privately with Above Board Cars</Link> · <Link href="/irish-cars">Irish registered cars for sale</Link> · <Link href="/how-it-works">How importing works</Link> · <Link href="/used-cars">UK cars priced for Ireland</Link>
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
  three: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, margin: "18px 0 8px" },
  priceCard: { border: "2px solid #b60b0c", borderRadius: 12, padding: "14px 16px", background: "#fff" },
  priceLbl: { fontSize: 11.5, color: "#b60b0c", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 700 },
  priceHead: { fontSize: 17, fontWeight: 700, margin: "2px 0 4px" },
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
