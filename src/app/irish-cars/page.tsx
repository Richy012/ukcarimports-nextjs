import type { Metadata } from "next";
import Link from "next/link";
import { irishListings } from "@/lib/irishListings";

/**
 * Irish-registered cars for sale — the Above Board Cars listings. STAGING.
 * Every car here is already on Irish plates, sold by its owner, with an
 * inspection, a warranty and an escrow-style payment behind the sale. It is
 * the one part of the site that is not a UK import, and it exists so a
 * Above Board Cars seller's car is actually advertised (owner, 6 Sep).
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Irish Registered Cars for Sale — Sold Privately, Protected by Above Board Cars",
  description:
    "Irish-registered cars sold by their owners with an independent inspection, a warranty and protected payment behind every sale. No dealer margin, no risk of a private sale.",
  alternates: { canonical: "https://ukcarimports.ie/irish-cars" },
  openGraph: { type: "website", url: "https://ukcarimports.ie/irish-cars", siteName: "UK Car Imports", locale: "en_IE", title: "Irish Registered Cars for Sale — Sold Privately, Protected by Above Board Cars", description: "Irish-registered cars sold by their owners with an independent inspection, a 12-month warranty and protected payment behind every sale.",
    images: [{ url: "https://ukcarimports.ie/assets/images/hero-rot-nocosts.jpg", width: 1672, height: 941, alt: "UK Car Imports" }] },
  twitter: { card: "summary_large_image", title: "Irish Registered Cars for Sale — Sold Privately, Protected by Above Board Cars", description: "Irish-registered cars sold by their owners with an independent inspection, a 12-month warranty and protected payment behind every sale.", images: ["https://ukcarimports.ie/assets/images/hero-rot-nocosts.jpg"] },
};

const eur = (n: number) => "€" + Math.round(n).toLocaleString("en-IE");

export default async function IrishCarsPage() {
  const cars = await irishListings();
  return (
    <main style={S.page}>
      <h1 style={S.h1}>Irish registered cars for sale</h1>
      <p style={S.lede}>
        Already on Irish plates, sold by their owners. Every one is backed by <b>Above Board Cars</b>:
        an independent mechanical inspection, an industry-standard warranty, and a protected
        payment &mdash; so you get private-sale value with garage-level safety. You deal with us,
        not a stranger.
      </p>
      {cars.length === 0 ? (
        <p style={S.empty}>No Irish cars listed right now. <Link href="/trade-ins">Selling yours?</Link></p>
      ) : (
        <div style={S.grid}>
          {cars.map((c) => (
            <Link key={c.id} href={`/irish-cars/${c.id}`} style={S.card}>
              {c.photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photos[0]} alt={c.title} style={S.img} />
              ) : (
                <div style={{ ...S.img, display: "grid", placeItems: "center", color: "#94a3b8" }}>photos to follow</div>
              )}
              <div style={S.body}>
                <div style={S.badge}>Irish registered · Above Board Cars</div>
                <div style={S.title}>{c.title}</div>
                <div style={S.meta}>
                  {c.mileage != null ? `${c.mileage.toLocaleString("en-IE")} ${c.mileageUnit}` : ""}
                  {c.area ? ` · ${c.area}` : ""}
                  {c.serviceHistory ? ` · ${c.serviceHistory} history` : ""}
                </div>
                <div style={S.price}>{c.priceEur ? eur(c.priceEur) : "Price on application"}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <p style={S.foot}>
        Selling an Irish car? <Link href="/trade-ins">Get a range for it in ten seconds</Link> and list it
        here with Above Board Cars behind it.
      </p>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1100, margin: "0 auto", padding: "24px 16px 60px" },
  h1: { fontSize: 30, margin: "0 0 6px" },
  lede: { color: "#475569", fontSize: 15, lineHeight: 1.55, margin: "0 0 20px", maxWidth: 760 },
  empty: { color: "#475569" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 },
  card: { display: "block", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", background: "#fff", color: "inherit", textDecoration: "none" },
  img: { width: "100%", aspectRatio: "4 / 3", objectFit: "cover", background: "#f1f5f9" },
  body: { padding: "10px 12px 12px" },
  badge: { fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a7d33", fontWeight: 700 },
  title: { fontSize: 17, fontWeight: 700, marginTop: 2 },
  meta: { fontSize: 12.5, color: "#64748b", marginTop: 2 },
  price: { fontSize: 18, fontWeight: 800, marginTop: 6 },
  foot: { marginTop: 24, color: "#475569", fontSize: 14 },
};
