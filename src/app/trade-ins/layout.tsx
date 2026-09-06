import type { Metadata } from "next";

/**
 * /trade-ins is a client component, so its SEO lives here (owner, 6 Sep: "I hope you SEO'd the
 * fuck out of that trade ins page" — until this file it inherited the site-wide title and had no
 * canonical, no Open Graph and no structured data). Child routes override what they need:
 * /trade-ins/above-board-cars sets its own title/canonical; /trade-ins/status/* is noindex.
 */
const TITLE = "Trade In Your Car in Ireland — See What It Is Worth in 10 Seconds | UK Car Imports";
const DESC =
  "Reg and mileage, and you see two measured ranges for your car: what a trade would pay against a UK import, and what it could sell for privately with Above Board Cars protection. Real Irish sales, no sign-up, no obligation.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESC,
  keywords: ["trade in my car Ireland", "trade in value Ireland", "car trade-in Ireland", "sell my car Ireland", "what is my car worth Ireland", "part exchange Ireland"],
  alternates: { canonical: "https://ukcarimports.ie/trade-ins" },
  openGraph: {
    type: "website",
    url: "https://ukcarimports.ie/trade-ins",
    siteName: "UK Car Imports",
    title: TITLE,
    description: DESC,
    locale: "en_IE",
    images: [{ url: "https://ukcarimports.ie/assets/images/hero-rot-nocosts.jpg", width: 1672, height: 941, alt: "UK Car Imports — trade in your car against a UK import" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["https://ukcarimports.ie/assets/images/hero-rot-nocosts.jpg"] },
  robots: { index: true, follow: true },
};

export default function TradeInsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
