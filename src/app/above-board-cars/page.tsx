import DraftBanner from "@/app/components/DraftBanner";
/**
 * /above-board-cars — STAGING.
 *
 * THE AUDIENCE HERE IS THE BUYER, NOT THE SELLER. This is the page a private
 * seller sends to anyone who rings about their DoneDeal advert
 * (owner's spec, 31 Aug: "share a link with anyone who contacts them to our
 * site to get the details of how it works"). So it answers a stranger's
 * question — "why is it safe to send money to someone I have never met?" —
 * and never talks to the seller about listing their car.
 *
 * No prices anywhere. The price is whatever is on the seller's own advert.
 */

import type { Metadata } from "next";
import CopyLine from "./CopyLine";

export const metadata: Metadata = {
  title: "Above Board Cars — Taking the Pirate out of Private car sales",
  description:
    "Above Board Cars puts an escrow-like payment facility, an independent mechanical inspection and an industry-standard warranty behind a private car sale.",
};

const STEPS: { n: string; head: string; body: string }[] = [
  {
    n: "1",
    head: "You agree the price with the seller",
    body: "We are not the seller and we do not set the price. You deal with the owner directly, the way you would with any private sale.",
  },
  {
    n: "2",
    head: "The car is inspected independently",
    body: "We organise a mechanical inspection by an independent garage, and you see the report. The seller has already answered a full written condition questionnaire, and that record travels with the car — so what you are told and what the inspection finds can be held side by side.",
  },
  {
    n: "3",
    head: "Your money is held, not handed over",
    body: "You pay into an escrow-like facility rather than to the seller. The money is released once the car has changed hands properly and the paperwork is right. If the car is not as described, it does not get released.",
  },
  {
    n: "4",
    head: "The car comes with a warranty",
    body: "An industry-standard warranty goes on the car — the kind of cover you would expect from a garage, on a car you are buying from a private owner.",
  },
];

export default function PrivateProofPage() {
  return (
    <main style={S.page}>
      <DraftBanner style={S.banner}>WORKING DRAFT — staging. Nothing here is agreed.</DraftBanner>

      <div style={S.brand}>Above Board Cars</div>
      <p style={S.punch}>Taking the Pirate out of Private car sales.</p>

      <div style={S.adStrip}>
        <div style={S.adStripHead}>
          Tell all your potential buyers on DoneDeal about the garage-like protection
          Above Board Cars offers &mdash; put this line in your ad:
        </div>
        <CopyLine />
      </div>

      <h1 style={S.h1}>Buying this car privately, safely</h1>
      <p style={S.lede}>
        The seller you are talking to is a private owner, not a garage. Above Board Cars sits between
        you for the parts that normally make a private sale a leap of faith: the payment, the
        inspection and the warranty.
      </p>

      <div style={S.strap}>
        <b>What Above Board Cars is.</b> An intermediary providing an escrow-like payment facility,
        organising a mechanical inspection, and providing industry-standard warranties. Nothing
        more and nothing less — we never own the car and we never become the seller.
      </div>

      <h2 style={S.h2}>How it works</h2>
      {STEPS.map((s) => (
        <div key={s.n} style={S.step}>
          <div style={S.stepN}>{s.n}</div>
          <div>
            <div style={S.stepHead}>{s.head}</div>
            <p style={S.stepBody}>{s.body}</p>
          </div>
        </div>
      ))}

      <h2 style={S.h2}>The three things people actually worry about</h2>
      <div style={S.card}>
        <b style={S.cardT}>&ldquo;What if I pay and the car isn&rsquo;t what they said?&rdquo;</b>
        <p style={S.cardB}>
          Your money sits in the escrow-like facility until the handover is done properly. It is
          not the seller&rsquo;s money until then.
        </p>
      </div>
      <div style={S.card}>
        <b style={S.cardT}>&ldquo;What if something goes wrong next month?&rdquo;</b>
        <p style={S.cardB}>
          The car carries an industry-standard warranty. That is the cover a private sale normally
          has none of.
        </p>
      </div>
      <div style={S.card}>
        <b style={S.cardT}>&ldquo;How do I know the seller owns it?&rdquo;</b>
        <p style={S.cardB}>
          Before a car goes through Above Board Cars we check the registration certificate against the
          seller&rsquo;s own identity documents. A car whose paperwork does not line up does not go
          through.
        </p>
      </div>

      <h2 style={S.h2}>Who we are</h2>
      <p style={S.body}>
        Above Board Cars is run by <b>ukcarimports.ie</b>, an established Irish vehicle import
        business. If you want to talk to a person before you do anything, that is what we would
        prefer too.
      </p>
      <p style={S.body}>
        <a href="/contact" style={S.link}>
          Talk to us →
        </a>
      </p>

      <p style={S.foot}>
        Above Board Cars does not sell you the car and does not set its price. The seller is the owner
        named on the vehicle registration certificate.
      </p>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 760,
    margin: "0 auto",
    padding: "22px 16px 60px",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    color: "#1a1a1a",
  },
  adStrip: { background: "#fdf7f7", border: "1px solid #f3d6d6", borderRadius: 10, padding: "14px 16px", margin: "0 0 20px" },
  adStripHead: { fontSize: 14.5, fontWeight: 800, color: "#111", lineHeight: 1.4, marginBottom: 8 },
  banner: {
    background: "#fff8e6",
    border: "1px solid #f0dfae",
    color: "#9a6a00",
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: ".06em",
    textTransform: "uppercase",
    padding: "7px 12px",
    borderRadius: 6,
    marginBottom: 18,
  },
  brand: { fontSize: 12.5, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "#b60b0c", margin: "0 0 2px" },
  punch: { fontSize: 22, fontWeight: 700, fontStyle: "italic", color: "#111", margin: "0 0 18px", letterSpacing: "-.3px" },
  h1: { fontSize: 30, margin: "0 0 10px", letterSpacing: "-.6px" },
  h2: { fontSize: 19, margin: "30px 0 12px", letterSpacing: "-.3px" },
  lede: { fontSize: 15.5, color: "#555", margin: "0 0 20px", lineHeight: 1.6 },
  strap: {
    border: "1px solid #bfe0c6",
    background: "#f4faf5",
    borderRadius: 10,
    padding: "14px 16px",
    fontSize: 14,
    lineHeight: 1.6,
  },
  step: { display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 18 },
  stepN: {
    flex: "0 0 auto",
    width: 28,
    height: 28,
    borderRadius: 999,
    background: "#1a1a1a",
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  stepHead: { fontSize: 15.5, fontWeight: 700, marginBottom: 4 },
  stepBody: { fontSize: 13.5, color: "#555", lineHeight: 1.6, margin: 0 },
  card: {
    border: "1px solid #dcdcdc",
    borderRadius: 10,
    background: "#fff",
    padding: "14px 16px",
    marginBottom: 10,
  },
  cardT: { fontSize: 14.5, display: "block", marginBottom: 6 },
  cardB: { fontSize: 13.5, color: "#555", lineHeight: 1.6, margin: 0 },
  body: { fontSize: 14, color: "#3d3d3d", lineHeight: 1.65, margin: "0 0 10px" },
  link: { color: "#1a5fb4", fontSize: 14, fontWeight: 600 },
  foot: { fontSize: 11.5, color: "#999", marginTop: 26, lineHeight: 1.6 },
};
