"use client";

import { useEffect, useState } from "react";
import { staffAuthHeaders } from "@/lib/auth";

/**
 * Social advertising performance.
 *
 * Reports CLICKS and FOLLOW-UPS rather than likes, deliberately: Facebook
 * will not report engagement while the app is unpublished and X charges for
 * reads, but every advert links to our own site, so arrivals are ours to
 * count -- and a visit to the car page predicts a sale far better than a
 * like does.
 */

type Post = {
  id: number;
  posted_at: string;
  post_type: string;
  car_id: string | null;
  make_name: string | null;
  model_name: string | null;
  car_year: number | null;
  landed_eur: number | null;
  saving_eur: number | null;
  fuel: string | null;
  campaign: string;
  platforms: string | null;
  car_name: string | null;
  car_status: number | null;
  clicks: number;
  unique_clicks: number;
  followups: number;
};

type PlanRow = { date: string; weekday: string; type: string; make: string | null };
type MakeRow = { make_name: string; posts: number; clicks: number; avg_price: number };
type QueueRow = {
  make_name: string;
  last_posted_at: string | null;
  posts_count: number;
  status: string;
};

const eur = (n: number | null) =>
  n == null ? "—" : "€" + Math.round(n).toLocaleString("en-IE");

export default function SocialPage() {
  const [data, setData] = useState<{
    plan: PlanRow[];
    posts: Post[];
    by_make: MakeRow[];
    queue: QueueRow[];
    totals: Record<string, number>;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/admin-social-performance", {
        headers: staffAuthHeaders(),
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((j) => setData(j.data))
        .catch((e) => setErr(String(e)));
    load();
    const id = setInterval(load, 120_000);
    return () => clearInterval(id);
  }, []);

  if (err) return <main style={{ padding: 32 }}>Could not load ({err}).</main>;
  if (!data) return <main style={{ padding: 32 }}>Loading…</main>;

  const t = data.totals;
  const card = {
    background: "#fff",
    border: "1px solid #e3e3e3",
    borderRadius: 10,
    padding: "16px 18px",
    minWidth: 150,
  } as const;
  const th = {
    textAlign: "left" as const,
    padding: "8px 10px",
    borderBottom: "2px solid #eee",
    fontSize: 12,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    color: "#666",
  };
  const td = { padding: "8px 10px", borderBottom: "1px solid #f2f2f2", fontSize: 14 };

  return (
    <main style={{ padding: "28px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 26, color: "#b60b0c", marginBottom: 4 }}>
        Social advertising
      </h1>
      <p style={{ color: "#666", marginBottom: 22, fontSize: 14 }}>
        What we advertised, and what it actually produced. Clicks are arrivals on
        our own site from an advert link — a better predictor of a sale than a like,
        and the only measure Facebook and X cannot withhold.
      </p>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 26 }}>
        <div style={card}>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{t.posts ?? 0}</div>
          <div style={{ color: "#666", fontSize: 13 }}>adverts published</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{t.unique ?? 0}</div>
          <div style={{ color: "#666", fontSize: 13 }}>people arrived</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 26, fontWeight: 700 }}>
            {t.makes_done ?? 0}/{t.makes_queued ?? 0}
          </div>
          <div style={{ color: "#666", fontSize: 13 }}>makes covered</div>
        </div>
      </div>

      <h2 style={{ fontSize: 18, margin: "0 0 6px" }}>Planned</h2>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 10 }}>
        The next two weeks. A projection, not a promise &mdash; rejecting a draft leaves
        that make at the head of the queue and everything after it shifts back a day.
      </p>
      <div style={{ overflowX: "auto", marginBottom: 32 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", background: "#fff" }}>
          <thead>
            <tr>
              <th style={th}>Date</th>
              <th style={th}>Day</th>
              <th style={th}>Post type</th>
              <th style={th}>Make up next</th>
            </tr>
          </thead>
          <tbody>
            {(data.plan || []).map((p, i) => (
              <tr key={p.date} style={i === 0 ? { background: "#fff8f8" } : undefined}>
                <td style={{ ...td, fontWeight: i === 0 ? 700 : 400 }}>
                  {p.date}{i === 0 ? " (today)" : ""}
                </td>
                <td style={td}>{p.weekday}</td>
                <td style={td}>{p.type}</td>
                <td style={{ ...td, textTransform: "capitalize", fontWeight: 600 }}>
                  {p.make || <span style={{ color: "#888", fontWeight: 400 }}>market summary &mdash; no car</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 18, margin: "0 0 10px" }}>Every advert</h2>
      <div style={{ overflowX: "auto", marginBottom: 32 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", background: "#fff" }}>
          <thead>
            <tr>
              <th style={th}>Posted</th>
              <th style={th}>Type</th>
              <th style={th}>Car</th>
              <th style={th}>Price</th>
              <th style={th}>Saving</th>
              <th style={th}>Platforms</th>
              <th style={th}>Arrivals</th>
              <th style={th}>Enquiries</th>
            </tr>
          </thead>
          <tbody>
            {data.posts.length === 0 && (
              <tr>
                <td style={td} colSpan={8}>
                  Nothing published yet. Adverts appear here the moment one goes out.
                </td>
              </tr>
            )}
            {data.posts.map((p) => (
              <tr key={p.id}>
                <td style={td}>{p.posted_at?.slice(0, 16).replace("T", " ")}</td>
                <td style={td}>{p.post_type}</td>
                <td style={td}>
                  {p.car_id ? (
                    <a href={`/car/${p.car_id}`} style={{ color: "#b60b0c" }}>
                      {p.car_name || `${p.make_name} ${p.model_name}`}
                    </a>
                  ) : (
                    <span style={{ color: "#888" }}>market summary</span>
                  )}
                </td>
                <td style={td}>{eur(p.landed_eur)}</td>
                <td style={td}>{p.saving_eur ? eur(p.saving_eur) : "—"}</td>
                <td style={{ ...td, fontSize: 12, color: "#666" }}>{p.platforms}</td>
                <td style={{ ...td, fontWeight: 700 }}>{p.unique_clicks}</td>
                <td style={{ ...td, fontWeight: 700, color: p.followups ? "#0a7d33" : "#999" }}>
                  {p.followups}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 18, margin: "0 0 10px" }}>By make</h2>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 10 }}>
        Which marques earn their turn. Too thin to act on until several cycles have run.
      </p>
      <div style={{ overflowX: "auto", marginBottom: 32 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", background: "#fff" }}>
          <thead>
            <tr>
              <th style={th}>Make</th>
              <th style={th}>Adverts</th>
              <th style={th}>Arrivals</th>
              <th style={th}>Avg price</th>
            </tr>
          </thead>
          <tbody>
            {data.by_make.length === 0 && (
              <tr>
                <td style={td} colSpan={4}>No data yet.</td>
              </tr>
            )}
            {data.by_make.map((m) => (
              <tr key={m.make_name}>
                <td style={{ ...td, textTransform: "capitalize" }}>{m.make_name}</td>
                <td style={td}>{m.posts}</td>
                <td style={{ ...td, fontWeight: 700 }}>{m.clicks}</td>
                <td style={td}>{eur(m.avg_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 18, margin: "0 0 10px" }}>Rotation queue</h2>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 10 }}>
        Next up first. A make is ticked off when its advert publishes, then returns
        at the back of the queue — coverage, not elimination.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", background: "#fff" }}>
          <thead>
            <tr>
              <th style={th}>Make</th>
              <th style={th}>Last featured</th>
              <th style={th}>Times</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.queue.map((q) => (
              <tr key={q.make_name}>
                <td style={{ ...td, textTransform: "capitalize" }}>{q.make_name}</td>
                <td style={td}>
                  {q.last_posted_at ? q.last_posted_at.slice(0, 10) : (
                    <span style={{ color: "#b60b0c", fontWeight: 600 }}>never</span>
                  )}
                </td>
                <td style={td}>{q.posts_count}</td>
                <td style={td}>{q.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
