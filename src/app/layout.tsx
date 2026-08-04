import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { GTM_ID } from "@/lib/gtm";
import "./globals.css";

const LIVE_HOSTS = new Set(["ukcarimports.ie", "www.ukcarimports.ie"]);

const baseMetadata: Metadata = {
  // Until cutover flips SITE_INDEXABLE=1 (env change + rebuild), every page
  // carries noindex — staging must never compete with the live site in
  // Google. robots.ts serves the matching Disallow. Neither existed before
  // 2026-08-04; staging had been fully crawlable.

  title: {
    default: "UK Car Imports – Import Your Car from the UK to Ireland",
    template: "%s | UK Car Imports",
  },
  description:
    "Safe and easy way to buy UK used cars from Ireland - VRT & NOx fees due per car. Optional mechanical & condition inspection reports. Optional warranty cover & VRT processing.",
};

// noindex follows the request host, so staging can never be indexed even
// though it shares this process with the live site.
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = (h.get("host") || "").toLowerCase().split(":")[0];
  if (LIVE_HOSTS.has(host)) return baseMetadata;
  return { ...baseMetadata, robots: { index: false, follow: false } };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/* Every car photo is served from the API origin, so the connection is
            worth opening before the first <img> is discovered. */}
        {/* Chrome/iOS request these unprompted; a 404 on apple-touch-icon
            logged a console error and cost 4 Best-Practices points. */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="preconnect" href="https://api.ukcarimports.ie" />
        <link rel="dns-prefetch" href="https://api.ukcarimports.ie" />
      </head>
      <body className="min-h-full flex flex-col">
        {/* Same GTM container as the legacy site — analytics continuity
            across cutover. Loads on the visitor's FIRST INTERACTION (scroll,
            tap, key, mouse) rather than page-load: GTM is 320KB and ~300ms
            of main-thread blocking (measured 2026-08-03/04), and a visitor
            who never interacts is a bounce whichever way it's counted.
            Owner call 2026-08-04: "I do look at analytics" — kept, deferred. */}
        <Script id="gtm" strategy="lazyOnload">
          {`(function(){var fired=false;function load(){if(fired)return;fired=true;
['wheel','pointerdown','keydown','touchstart'].forEach(function(e){window.removeEventListener(e,load,{passive:true});});
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');}
['wheel','pointerdown','keydown','touchstart'].forEach(function(e){window.addEventListener(e,load,{passive:true});});
})();`}
        </Script>
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
            title="gtm"
          />
        </noscript>
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
