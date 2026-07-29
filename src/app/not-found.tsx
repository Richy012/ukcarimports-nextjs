import Link from "next/link";

export default function NotFound() {
  return (
    <main
      style={{
        maxWidth: 600,
        margin: "0 auto",
        padding: "80px 16px",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 28, color: "#b60b0c", marginBottom: 12 }}>Page not found</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Sorry, we couldn&apos;t find the page you were looking for.
      </p>
      <Link href="/used-cars" style={{ color: "#b60b0c", fontWeight: 700 }}>
        Browse our used cars
      </Link>
    </main>
  );
}
