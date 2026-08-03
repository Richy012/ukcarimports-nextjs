import { permanentRedirect } from "next/navigation";

// The standalone Bestseller showcase was retired 2026-08-03 (owner: "an
// extra page too much — it only advertised them, and the homepage band
// already does that"). The browsing experience lives on /used-cars with the
// Bestseller Series toggle, where the full filter bar works on the badge
// set. The maths pages under /best-value/why/[carId] remain — they are the
// audit trail every badge links to.
export default function BestValuePage() {
  permanentRedirect("/used-cars?bestseller=1");
}
