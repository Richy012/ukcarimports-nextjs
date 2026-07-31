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
