// Google Tag Manager wiring (cutover gate #32). Container GTM-TG3JMV8 is the
// SAME one the legacy site runs, so GA4 config, triggers, and any history-
// change listeners carry over unchanged — analytics continuity across cutover.
export const GTM_ID = "GTM-TG3JMV8";

type DataLayerEvent = { event: string; [key: string]: unknown };

declare global {
  interface Window {
    dataLayer?: DataLayerEvent[];
  }
}

export function gtmPush(event: DataLayerEvent) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
}

// Direct GA4 sender (2026-08-14). The GTM container's conversion triggers were
// selector-bound to the LEGACY site's DOM, so they went quiet at cutover (GA4
// deposit confirms: Jul 179 -> Aug ~1.6/day), and the container itself is not
// editable from here. Conversion events therefore go straight to GA4 via
// gtag.js on its own dataLayer2 (so GTM never double-processes), loaded only
// when the first tracked event fires, events-only (send_page_view: false --
// GTM keeps page_views), same staff gate as the GTM snippet in layout.tsx.
const GA4_ID = "G-WJYR2XTESM";
let ga4Ready = false;

function ensureGa4() {
  if (ga4Ready || typeof window === "undefined") return;
  try {
    if (localStorage.getItem("staff_token")) return;
  } catch {}
  if (/^\/(dashboard|leads|members|comparisons|deposits|templates|staff-login|cars(\/|$))/.test(location.pathname)) return;
  const w = window as unknown as { dataLayer2?: unknown[]; gtag?: (...a: unknown[]) => void };
  w.dataLayer2 = w.dataLayer2 || [];
  if (!w.gtag) {
    // gtag.js only processes `arguments` objects pushed onto its layer — a
    // plain array is silently ignored (verified live 2026-08-14, zero
    // /g/collect requests until this was fixed).
    w.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      (w.dataLayer2 as unknown[]).push(arguments);
    };
  }
  if (!document.getElementById("ga4-direct")) {
    const s = document.createElement("script");
    s.id = "ga4-direct";
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA4_ID + "&l=dataLayer2";
    document.head.appendChild(s);
    w.gtag("js", new Date());
    w.gtag("config", GA4_ID, { send_page_view: false });
  }
  ga4Ready = true;
}

export function track(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  gtmPush({ event, ...(params || {}) });
  ensureGa4();
  const w = window as unknown as { gtag?: (...a: unknown[]) => void };
  if (w.gtag) w.gtag("event", event, params || {});
}
