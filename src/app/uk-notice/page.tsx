import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Access Unavailable",
  robots: { index: false, follow: false },
};

// The UK wall — same wording as the legacy site's WarningPage.
export default function UkNoticePage() {
  return (
    <main style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "3rem 1.5rem" }}>
      <div>
        <h1 style={{ letterSpacing: "0.06em" }}>ACCESS UNAVAILABLE</h1>
        <p style={{ marginTop: "1rem", color: "#555" }}>
          Unfortunately this service is not available at your location. Apologies for any inconvenience.
        </p>
      </div>
    </main>
  );
}
