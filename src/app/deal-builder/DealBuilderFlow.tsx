"use client";

/**
 * The Deal Builder as ONE moving picture. Staging.
 *
 * Owner, 6 Sep, across several passes: "the dealer takes both the trade-in
 * and the import resale"; "the margin on the sale goes to you as does any
 * margin on the trade-in resale"; "just say the fee is paid by the client";
 * "You manage the import sale to the customer and take the margin"; the
 * finance point ("buy the car into stock and resell on finance to the client
 * making even more margin") must be in the animation; and "the panel of
 * dealers bids on each deal (import sale + trade-in) and best bid wins".
 *
 * Three parties on one stage — the customer, UK Car Imports, your garage —
 * and the things that move between them travel in five beats with one
 * caption each. Icons are the site's Lucide family; nothing drawn by hand.
 * Loops; reduced-motion gets the last frame with the captions listed.
 *
 * Layout rule learned the hard way: nothing that belongs to the dealer is
 * ever placed under our column. Tokens on the bottom lane that arrive at the
 * garage stop at 62% so the garage's own token at 83% is never covered.
 */

import { useEffect, useState } from "react";
import { User, Building2, Warehouse, Car, CarFront, BadgeEuro, Ban, FileText, Gavel, Trophy, type LucideIcon } from "lucide-react";

const BEAT_MS = 4200;
const MOVE_MS = BEAT_MS - 800;

const BEATS = [
  { t: "A customer comes to us for a UK import — and has a car to trade in.",
    d: "We are a virtual garage. No forecourt, so we cannot take the trade-in ourselves." },
  { t: "So we hand the whole deal to our dealer panel.",
    d: "The import to resell to that customer, and their trade-in to buy from them. Full file — photos, condition, history, Irish market evidence. No names until it is agreed." },
  { t: "The panel bids on the deal. Best bid wins.",
    d: "Every dealer on the panel sees the same file and bids what they would give for the trade-in against the import. The best bid takes both cars. Indicative until you inspect." },
  { t: "You manage the import sale to the customer and take the margin — and you take the trade-in.",
    d: "The margin on the sale of the import goes to you, and so does any margin on the resale of the trade-in. Or buy the import into stock and sell it to the client on your own finance — and take that margin too." },
  { t: "If it all works out, we get a fee — paid by the client.",
    d: "Nothing comes out of your side of the deal. Nothing binds you sight-unseen either — every bid is indicative until you inspect." },
];

function Party({ icon: Icon, label, sub, lit }: { icon: LucideIcon; label: string; sub: string; lit: boolean }) {
  return (
    <div style={S.party}>
      <div style={{ ...S.partyIcon, ...(lit ? S.partyIconLit : {}) }}><Icon size={26} strokeWidth={1.6} aria-hidden="true" /></div>
      <div style={S.partyLabel}>{label}</div>
      <div style={S.partySub}>{sub}</div>
    </div>
  );
}

export default function DealBuilderFlow() {
  const [beat, setBeat] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  useEffect(() => {
    if (reduced) { setBeat(BEATS.length - 1); return; }
    const id = setInterval(() => setBeat((b) => (b + 1) % BEATS.length), BEAT_MS);
    return () => clearInterval(id);
  }, [reduced]);

  const b = BEATS[beat];

  return (
    <section style={S.wrap} aria-label="How the Deal Builder works">
      <style>{`
        /* lanes: the customer sits at 17%, UK Car Imports at 50%, your garage at 83% */
        @keyframes dbfCU { from { left: 17%; opacity: 0 } 12% { opacity: 1 } to { left: 50%; opacity: 1 } }
        @keyframes dbfUD { from { left: 50%; opacity: 0 } 12% { opacity: 1 } to { left: 83%; opacity: 1 } }
        @keyframes dbfDC { from { left: 83%; opacity: 0 } 12% { opacity: 1 } to { left: 17%; opacity: 1 } }
        @keyframes dbfC62 { from { left: 17%; opacity: 0 } 12% { opacity: 1 } to { left: 62%; opacity: 1 } }
        @keyframes dbfFade { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
        @keyframes dbfPop { from { opacity: 0; transform: translate(-50%, 6px) scale(.9) } to { opacity: 1; transform: translate(-50%, 0) scale(1) } }
        .dbfTok { position: absolute; transform: translateX(-50%); display: inline-flex; align-items: center; gap: 6px;
                  padding: 6px 10px; border-radius: 999px; background: #fff; border: 1px solid #e2e8f0;
                  box-shadow: 0 2px 8px rgba(0,0,0,.10); font-size: 12.5px; font-weight: 600; white-space: nowrap; }
        .dbfCU { animation: dbfCU ${MOVE_MS}ms ease-in-out forwards; }
        .dbfUD { animation: dbfUD ${MOVE_MS}ms ease-in-out forwards; }
        .dbfDC { animation: dbfDC ${MOVE_MS}ms ease-in-out forwards; }
        .dbfC62 { animation: dbfC62 ${MOVE_MS}ms ease-in-out forwards; }
        .dbfPop { animation: dbfPop .5s ease-out .4s both; }
        .dbfPop2 { animation: dbfPop .5s ease-out 1.3s both; }
        .dbfPop3 { animation: dbfPop .5s ease-out 2.4s both; }
        .dbfCap { animation: dbfFade .35s ease-out; }
        @media (prefers-reduced-motion: reduce) { .dbfCU, .dbfUD, .dbfDC, .dbfC62, .dbfPop, .dbfPop2, .dbfPop3, .dbfCap { animation: none !important; } }
      `}</style>

      <div style={S.stage}>
        <Party icon={User} label="The customer" sub="wants a UK import, has a car to trade in" lit={beat === 0 || beat === 3} />
        <Party icon={Building2} label="UK Car Imports" sub="a virtual garage — no forecourt" lit={beat === 0 || beat === 1 || beat === 4} />
        <Party icon={Warehouse} label="Your garage" sub="on the panel: bids, wins, takes both cars" lit={beat >= 1} />

        <div style={S.lanes} aria-hidden="true">
          {beat === 0 && !reduced && (
            <>
              <span key="want" className="dbfTok dbfCU" style={{ top: 4 }}>
                <CarFront size={16} strokeWidth={1.75} /> wants a UK import
              </span>
              <span key="ti" className="dbfTok dbfCU" style={{ bottom: 6 }}>
                <Car size={16} strokeWidth={1.75} /> has a trade-in
                <Ban size={14} strokeWidth={2} style={{ color: "#b60b0c", marginLeft: 2 }} />
              </span>
            </>
          )}
          {beat === 1 && !reduced && (
            <>
              <span key="imp" className="dbfTok dbfUD" style={{ top: 4 }}>
                <CarFront size={16} strokeWidth={1.75} /> the import, to resell
              </span>
              <span key="file" className="dbfTok dbfUD" style={{ bottom: 6 }}>
                <FileText size={16} strokeWidth={1.75} /> the trade-in, full file
              </span>
            </>
          )}
          {beat === 2 && (
            <>
              <span key="b1" className="dbfTok dbfPop" style={{ top: 4, left: "70%" }}>
                <Gavel size={15} strokeWidth={1.75} /> dealer A bids
              </span>
              <span key="b2" className="dbfTok dbfPop2" style={{ top: 4, left: "90%" }}>
                <Gavel size={15} strokeWidth={1.75} /> dealer B bids
              </span>
              <span key="win" className="dbfTok dbfPop3" style={{ bottom: 6, left: "83%", borderColor: "#fde68a", background: "#fffbeb" }}>
                <Trophy size={15} strokeWidth={1.75} /> best bid wins both cars
              </span>
            </>
          )}
          {beat === 3 && (
            <>
              {!reduced && (
                <span key="sell" className="dbfTok dbfDC" style={{ top: 4 }}>
                  <CarFront size={16} strokeWidth={1.75} /> you manage the import sale
                </span>
              )}
              <span key="m1" className="dbfTok dbfPop2" style={{ top: 4, left: "78%", borderColor: "#bbf7d0", background: "#f0fdf4", color: "#0a7d33" }}>
                <BadgeEuro size={16} strokeWidth={1.75} /> both margins — yours
              </span>
              {!reduced && (
                <span key="take" className="dbfTok dbfC62" style={{ bottom: 6 }}>
                  <Car size={16} strokeWidth={1.75} /> you take the trade-in
                </span>
              )}
              <span key="fin" className="dbfTok dbfPop3" style={{ bottom: 6, left: "86%", borderColor: "#bfdbfe", background: "#eff6ff", color: "#1d4ed8" }}>
                or sell it on your finance
              </span>
            </>
          )}
          {beat === 4 && (
            <>
              {!reduced && (
                <span key="fee" className="dbfTok dbfCU" style={{ top: 4, borderColor: "#fde68a", background: "#fffbeb" }}>
                  <BadgeEuro size={16} strokeWidth={1.75} /> our fee — paid by the client
                </span>
              )}
              <span key="done" className="dbfTok dbfPop2" style={{ bottom: 6, left: "50%", borderColor: "#bbf7d0", background: "#f0fdf4", color: "#0a7d33" }}>
                deal complete — customer has paid for the import
              </span>
            </>
          )}
        </div>
      </div>

      <div key={beat} className="dbfCap" style={S.cap}>
        <div style={S.capTag}>{beat + 1} of {BEATS.length}</div>
        <div style={S.capTitle}>{b.t}</div>
        <div style={S.capText}>{b.d}</div>
      </div>

      <div style={S.dots} role="tablist" aria-label="Beats">
        {BEATS.map((x, i) => (
          <button key={x.t} type="button" role="tab" aria-selected={i === beat} onClick={() => setBeat(i)}
                  style={{ ...S.dot, ...(i === beat ? S.dotOn : {}) }} aria-label={`Beat ${i + 1}: ${x.t}`} />
        ))}
      </div>

      {reduced && (
        <ol style={{ margin: "10px 0 0 18px", padding: 0, fontSize: 14, lineHeight: 1.6 }}>
          {BEATS.map((x) => <li key={x.t}><b>{x.t}</b> {x.d}</li>)}
        </ol>
      )}
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { margin: "0 0 22px" },
  stage: { position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, padding: "40px 10px 42px",
           border: "1px solid #e2e8f0", borderRadius: 14, background: "linear-gradient(180deg,#fafafa,#fff)", minHeight: 210 },
  lanes: { position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3 },
  party: { textAlign: "center", padding: "6px 4px", position: "relative", zIndex: 1 },
  partyIcon: { width: 56, height: 56, margin: "0 auto 6px", borderRadius: 999, border: "2px solid #cbd5e1", color: "#64748b",
               display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", transition: "all .3s" },
  partyIconLit: { borderColor: "#b60b0c", color: "#b60b0c", boxShadow: "0 0 0 6px rgba(182,11,12,.10)" },
  partyLabel: { fontSize: 14, fontWeight: 700 },
  partySub: { fontSize: 11.5, color: "#64748b", lineHeight: 1.35, marginTop: 2 },
  cap: { marginTop: 12, padding: "12px 14px", border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", minHeight: 110 },
  capTag: { fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", color: "#b60b0c", fontWeight: 700 },
  capTitle: { fontSize: 18, fontWeight: 700, margin: "2px 0 4px" },
  capText: { fontSize: 14, color: "#333", lineHeight: 1.5 },
  dots: { display: "flex", gap: 8, justifyContent: "center", marginTop: 10 },
  dot: { width: 10, height: 10, borderRadius: 999, border: 0, background: "#cbd5e1", cursor: "pointer", padding: 0 },
  dotOn: { background: "#b60b0c", transform: "scale(1.25)" },
};
