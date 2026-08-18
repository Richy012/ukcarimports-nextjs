import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

// County landing pages — restores the /used-cars/<county> family that ranked
// for years (Limerick alone: 23,743 impressions/90d at position 7) and then
// served 404s after the August migration. The honest answer to "used cars
// <county>": the biggest used-car selection available to a buyer in that
// county doesn't have a forecourt — every car is priced fully landed and
// registered at their local NCTS centre.
//
// Republic ONLY. NI counties must never get pages (NI stock is excluded from
// the business entirely). Unknown slugs 404 via dynamicParams=false.

const COUNTIES: Record<string, string> = {
  carlow: "Carlow", cavan: "Cavan", clare: "Clare", cork: "Cork",
  donegal: "Donegal", dublin: "Dublin", galway: "Galway", kerry: "Kerry",
  kildare: "Kildare", kilkenny: "Kilkenny", laois: "Laois", leitrim: "Leitrim",
  limerick: "Limerick", longford: "Longford", louth: "Louth", mayo: "Mayo",
  meath: "Meath", monaghan: "Monaghan", offaly: "Offaly", roscommon: "Roscommon",
  sligo: "Sligo", tipperary: "Tipperary", waterford: "Waterford",
  westmeath: "Westmeath", wexford: "Wexford", wicklow: "Wicklow",
};

const API_BASE = "https://api.ukcarimports.ie/public";

export const dynamicParams = false;
export const revalidate = 900;

export function generateStaticParams() {
  return Object.keys(COUNTIES).map((county) => ({ county }));
}

interface BestValueCar {
  car_id: string;
  car_name: string;
  featured_image: string;
  best_value?: number | null;
  saving_eur?: number | null;
  final_price_eur?: number | null;
}

async function getShowcase(): Promise<BestValueCar[]> {
  try {
    const res = await fetch(`${API_BASE}/best-value/0/60?rotate=daily`, {
      next: { revalidate: 900 },
    });
    if (!res.ok) return [];
    const j = await res.json();
    const cars: BestValueCar[] = j?.data ?? j?.cars ?? [];
    return cars.filter((c) => c.featured_image).slice(0, 6);
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ county: string }>;
}): Promise<Metadata> {
  const { county } = await params;
  const name = COUNTIES[county];
  // Hard guard: only the 26 Republic counties exist. NI counties and garbage
  // slugs must 404 — dynamicParams=false alone proved insufficient in the
  // deployed build (antrim rendered "undefined").
  if (!name) notFound();
  const url = `https://ukcarimports.ie/used-cars/${county}`;
  const title = `Used Cars ${name} — Compare Local Prices with a UK Import, VRT Included`;
  const description = `Buying a used car in ${name}? Compare the forecourt price with importing the same car from the UK: every one of our 100,000+ cars is priced fully landed — VRT, VAT, customs and transport included — and registered at your local NCTS centre.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, siteName: "UK Car Imports", title, description, locale: "en_IE" },
  };
}

export default async function CountyPage({
  params,
}: {
  params: Promise<{ county: string }>;
}) {
  const { county } = await params;
  const name = COUNTIES[county];
  if (!name) notFound();
  const cars = await getShowcase();

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 16px 60px" }}>
      <h1 style={{ fontSize: "clamp(26px,4.5vw,38px)", letterSpacing: "-0.5px", margin: "0 0 10px" }}>
        Used cars in {name} — the biggest selection has no forecourt
      </h1>
      <p style={{ fontSize: 16.5, lineHeight: 1.6, color: "#444", maxWidth: 720, margin: "0 0 6px" }}>
        Every used car on a {name} forecourt was bought somewhere else and priced for the
        forecourt. We do the same job in the other direction, for you: choose from over
        100,000 UK cars, each shown at its full landed price — the car, VAT, customs,
        VRT, transport and our fee. The price you see is the price you pay.
      </p>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: "#666", maxWidth: 720, margin: "0 0 22px" }}>
        Thousands of our cars are measured below comparable Irish asking prices —{" "}
        <Link href="/best-value" style={{ color: "#b60b0c" }}>we publish the maths per car</Link>.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "0 0 30px" }}>
        <Link href="/used-cars" style={{ background: "#b60b0c", color: "#fff", borderRadius: 6, padding: "12px 22px", fontWeight: 700, fontSize: 14.5, textDecoration: "none" }}>
          Browse all cars
        </Link>
        <Link href="/how-it-works" style={{ border: "1px solid #ccc", color: "#1a1a1a", borderRadius: 6, padding: "12px 22px", fontWeight: 600, fontSize: 14.5, textDecoration: "none" }}>
          How importing works
        </Link>
      </div>

      {cars.length > 0 && (
        <>
          <h2 style={{ fontSize: 20, margin: "0 0 12px" }}>Priced below the Irish market this week</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14, marginBottom: 34 }}>
            {cars.map((c) => (
              <Link key={c.car_id} href={`/car/${c.car_id}`} style={{ border: "1px solid #e2e2e2", borderRadius: 10, overflow: "hidden", textDecoration: "none", color: "#1a1a1a", background: "#fff" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.featured_image} alt={c.car_name} loading="lazy" style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} />
                <span style={{ display: "block", padding: "10px 12px", fontSize: 13.5, fontWeight: 600, lineHeight: 1.4 }}>{c.car_name}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 style={{ fontSize: 20, margin: "0 0 10px" }}>How it works from {name}</h2>
      <ol style={{ fontSize: 15, lineHeight: 1.8, color: "#444", maxWidth: 720, paddingLeft: 20, margin: "0 0 26px" }}>
        <li>Pick your car and place the deposit — the landed price is already on every car.</li>
        <li>We inspect, buy, ship and clear it: VAT, customs and VRT are all in the shown price.</li>
        <li>The VRT inspection and registration are completed through the NCTS — you book your
            local {name} appointment at ncts.ie and we prepare every document you need for it.</li>
        <li>Irish plates on, done — typically about two weeks from deposit.</li>
      </ol>

      <h2 style={{ fontSize: 20, margin: "0 0 10px" }}>Why not just buy locally in {name}?</h2>
      <p style={{ fontSize: 15, lineHeight: 1.7, color: "#444", maxWidth: 720, margin: "0 0 8px" }}>
        Often you should — a good local car at a fair price is a fine buy. The reason {name} buyers
        use us is choice and measured price: the UK market holds several times the stock of the
        whole of Ireland, and we benchmark every import against real Irish asking prices so you can
        see the difference before you commit. If the saving isn&rsquo;t there, we&rsquo;ll show you that too.
      </p>
      <p style={{ fontSize: 13.5, color: "#777", maxWidth: 720, lineHeight: 1.6 }}>
        UK Car Imports — 13 years importing UK cars for Irish buyers. Savings are measured against
        Carzone asking prices for the same make, model and year (10+ Irish listings), refreshed
        continuously; Irish figures are asking prices, ours are final.
      </p>
    </main>
  );
}
