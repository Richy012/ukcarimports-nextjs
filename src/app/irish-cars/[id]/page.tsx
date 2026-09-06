import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { irishListing } from "@/lib/irishListings";
import EnquiryForm from "./EnquiryForm";

/** One Irish-registered car — the Above Board Cars advert. STAGING. */
export const dynamic = "force-dynamic";

const eur = (n: number) => "€" + Math.round(n).toLocaleString("en-IE");

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = await irishListing(id);
  if (!c) return { title: "Car not found" };
  return {
    title: `${c.title} for sale in Ireland — private sale, Above Board Cars protected`,
    description: `${c.title}${c.mileage != null ? `, ${c.mileage.toLocaleString("en-IE")} ${c.mileageUnit}` : ""}, Irish registered, sold by the owner with an independent inspection, warranty and protected payment.`,
    alternates: { canonical: `https://ukcarimports.ie/irish-cars/${c.id}` },
  };
}

export default async function IrishCarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await irishListing(id);
  if (!c) notFound();

  return (
    <main style={S.page}>
      <nav style={S.crumb}><Link href="/">Home</Link> / <Link href="/irish-cars">Irish registered cars</Link> / <span>{c.title}</span></nav>
      <div style={S.badge}>Irish registered · sold by the owner · Above Board Cars protected</div>
      <h1 style={S.h1}>{c.title}</h1>
      <div style={S.meta}>
        {c.mileage != null ? `${c.mileage.toLocaleString("en-IE")} ${c.mileageUnit}` : ""}
        {c.trim ? ` · ${c.trim}` : ""}
        {c.area ? ` · ${c.area}` : ""}
      </div>
      <div style={S.price}>{c.priceEur ? eur(c.priceEur) : "Price on application"}</div>

      {c.photos.length > 0 && (
        <div style={S.gallery}>
          {c.photos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p} src={p} alt={`${c.title} — photo ${i + 1}`} style={i === 0 ? S.hero : S.thumb} loading={i < 2 ? "eager" : "lazy"} />
          ))}
        </div>
      )}

      <div style={S.cols}>
        <section style={S.box}>
          <h2 style={S.h2}>The car, as declared by the owner</h2>
          <div style={S.row}><span>NCT</span><b>{c.nct || "—"}</b></div>
          <div style={S.row}><span>Service history</span><b>{c.serviceHistory || "—"}</b></div>
          <div style={S.row}><span>Bodywork</span><b>{c.damage || "—"}</b></div>
          <p style={S.small}>
            These answers travel with the sale as a condition record and the independent inspection
            checks them. If something substantive was not disclosed, you can withdraw and the protected
            payment returns to you.
          </p>
        </section>
        <section style={S.box}>
          <h2 style={S.h2}>What Above Board Cars gives you</h2>
          <ul style={S.ul}>
            <li>An independent mechanical inspection before you pay.</li>
            <li>An industry-standard warranty behind the car.</li>
            <li>A protected, escrow-style payment &mdash; the seller is paid when you have the car.</li>
            <li>You deal with us, not a stranger. We pass your enquiry to the owner.</li>
          </ul>
        </section>
      </div>

      <section style={{ ...S.box, marginTop: 16 }}>
        <h2 style={S.h2}>Ask about this car</h2>
        <EnquiryForm id={c.id} title={c.title} />
      </section>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1000, margin: "0 auto", padding: "20px 16px 60px" },
  crumb: { fontSize: 13, color: "#64748b", marginBottom: 10 },
  badge: { fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".05em", color: "#0a7d33", fontWeight: 700 },
  h1: { fontSize: 30, margin: "2px 0 4px" },
  meta: { color: "#64748b", fontSize: 14 },
  price: { fontSize: 26, fontWeight: 800, margin: "6px 0 14px" },
  gallery: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 18 },
  hero: { gridColumn: "1 / -1", width: "100%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 12, background: "#f1f5f9" },
  thumb: { width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 8, background: "#f1f5f9" },
  cols: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 },
  box: { border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 16px", background: "#fff" },
  h2: { fontSize: 17, margin: "0 0 8px" },
  row: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9", fontSize: 14 },
  small: { fontSize: 12.5, color: "#64748b", lineHeight: 1.5, marginTop: 8 },
  ul: { margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 },
};
