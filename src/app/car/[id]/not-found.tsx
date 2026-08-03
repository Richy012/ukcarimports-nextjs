import Link from "next/link";

// Shown when /car/{id} has no live car behind it. Stock is hard-deleted from
// automerchcars_2 the moment the source ad dies, so an old link is almost
// always a SOLD car, not a bad URL — the generic "Page not found" read as a
// broken site. Wording follows the legacy SPA (SingleCar.jsx) so customers
// arriving from an old email or bookmark see the same thing either side of
// cutover. Still a real 404 status: the car genuinely isn't there any more.
export default function CarNotFound() {
  return (
    <main
      style={{
        maxWidth: 620,
        margin: "0 auto",
        padding: "80px 16px",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 28, color: "#b60b0c", marginBottom: 12 }}>
        Sorry, this car is no longer available
      </h1>
      <p style={{ color: "#666", marginBottom: 24, lineHeight: 1.6 }}>
        It has been sold or withdrawn by the garage. New cars land every day —
        you can search our active listings below.
      </p>
      <Link href="/used-cars" style={{ color: "#b60b0c", fontWeight: 700 }}>
        Browse our used cars
      </Link>
    </main>
  );
}
