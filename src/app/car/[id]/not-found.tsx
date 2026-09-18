"use client";

// Shown when /car/{id} has no live car behind it. Stock is hard-deleted from
// automerchcars_2 the moment the source ad dies, so an old link is almost
// always a SOLD car, not a bad URL — the generic "Page not found" read as a
// broken site. Still a real 404 status: the car genuinely isn't there any more.
//
// 2026-08-23: this page used to be a dead end — a headline and one link to the
// whole catalogue. Measured over 30 days, 218 distinct people landed on it,
// spent an average of SIX seconds, and half bounced. 152 of those 221 sessions
// were Direct, i.e. saved links, shared links and alert emails — so these are
// returning buyers whose car sold underneath them, not people picking sold
// stock off the site. They now get up to four live cars of the same model.
//
// Client component on purpose: Next's not-found.tsx receives no route params,
// so the car id is read from the pathname. Everything is best-effort — if the
// lookup fails the page falls back to exactly what it showed before.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface AltCar {
  car_id: string;
  car_name: string;
  featured_image: string;
  computed_final_price_v2: string | number | null;
}

function euro(v: string | number | null): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!n || !isFinite(n)) return "";
  return "€" + Math.round(n).toLocaleString("en-IE");
}

export default function CarNotFound() {
  const pathname = usePathname();
  const [cars, setCars] = useState<AltCar[]>([]);
  const [what, setWhat] = useState<string>("");

  useEffect(() => {
    const id = (pathname || "").split("/").filter(Boolean).pop() || "";
    if (!/^\d{6,20}$/.test(id)) return;
    let dead = false;
    fetch(`/api/sold-car-alternatives/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (dead) return;
        const d = j?.data;
        if (Array.isArray(d?.cars) && d.cars.length) {
          setCars(d.cars.slice(0, 4));
          setWhat([d.make, d.matched === "model" ? d.model : ""].filter(Boolean).join(" "));
        }
      })
      .catch(() => {
        /* the page still works without them */
      });
    return () => {
      dead = true;
    };
  }, [pathname]);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "64px 16px", textAlign: "center" }}>
      <h1 style={{ fontSize: 28, color: "#b60b0c", marginBottom: 12 }}>
        Sorry, this car is no longer available
      </h1>
      <p style={{ color: "#666", marginBottom: 28, lineHeight: 1.6 }}>
        It has been sold or withdrawn by the garage. New cars land every day —
        you can search our active listings below.
      </p>

      {cars.length > 0 && (
        <section style={{ margin: "0 auto 32px", maxWidth: 980 }}>
          <h2 style={{ fontSize: 20, marginBottom: 16, color: "#222" }}>
            {what ? `Available now — ${what}` : "Available now"}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 16,
              textAlign: "left",
            }}
          >
            {cars.map((c) => (
              <Link
                key={c.car_id}
                href={`/car/${c.car_id}`}
                style={{
                  display: "block",
                  border: "1px solid #e5e5e5",
                  borderRadius: 8,
                  overflow: "hidden",
                  textDecoration: "none",
                  color: "inherit",
                  background: "#fff",
                }}
              >
                <img
                  src={c.featured_image}
                  alt=""
                  width={300}
                  height={200}
                  loading="lazy"
                  style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }}
                />
                <div style={{ padding: "10px 12px 12px" }}>
                  <span style={{ display: "block", fontSize: 14, lineHeight: 1.35 }}>
                    {c.car_name}
                  </span>
                  {euro(c.computed_final_price_v2) && (
                    <strong style={{ display: "block", marginTop: 6, color: "#b60b0c" }}>
                      {euro(c.computed_final_price_v2)}
                    </strong>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <Link href="/used-cars" style={{ color: "#b60b0c", fontWeight: 700 }}>
        Browse our used cars
      </Link>
    </main>
  );
}
