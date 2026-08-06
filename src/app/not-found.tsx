import Link from "next/link";

// Dead-car links (Google cache, social posts, old emails) land here for the
// lifetime of the site -- cars sell and delist daily, links to them do not.
// A 404 status with a helpful body beats a dead end.
export default function NotFound() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "72px 20px",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 30, color: "#b60b0c", marginBottom: 12 }}>
        This page isn&apos;t here any more
      </h1>
      <p style={{ color: "#444", lineHeight: 1.7, marginBottom: 8 }}>
        If you followed a link to a car, it has most likely just been sold or
        delisted &mdash; good UK stock moves fast.
      </p>
      <p style={{ color: "#444", lineHeight: 1.7, marginBottom: 28 }}>
        We add hundreds of freshly-priced UK cars every day, each fully landed
        for Ireland &mdash; VRT, VAT, customs and delivery included.
      </p>
      <p style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
        <Link
          href="/used-cars"
          style={{
            background: "#b60b0c",
            color: "#fff",
            fontWeight: 700,
            padding: "12px 22px",
            borderRadius: 8,
          }}
        >
          Browse all cars
        </Link>
        <Link
          href="/used-cars?bestseller=1"
          style={{
            border: "2px solid #b60b0c",
            color: "#b60b0c",
            fontWeight: 700,
            padding: "10px 20px",
            borderRadius: 8,
          }}
        >
          See the Bestsellers
        </Link>
      </p>
    </main>
  );
}
