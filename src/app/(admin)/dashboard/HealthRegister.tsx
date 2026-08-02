"use client";

import styles from "./page.module.css";

/**
 * The pipeline health register, compiled 31 July 2026 after a sweep of every
 * recurring process and quality invariant in the build.
 *
 * It is deliberately a CHECKLIST, not live data. The panel above it shows what
 * is actually being collected right now; this shows what SHOULD be watched and
 * whether anything watches it yet. Items move from Blind to Watched as
 * monitoring gets built, so the list is the plan and the scoreboard at once.
 *
 * Why it matters, in the owner's own case: for a fortnight the site was up, the
 * process was online, disk was fine and cars kept arriving - six green lights -
 * while 65% of incoming records had the wrong seller name and the banned-dealer
 * list was bypassed entirely. Nothing was down; something had stopped being
 * true. Every row below is organised around that distinction.
 */

type State = "seen" | "part" | "blind";

interface Row {
  what: string;
  cadence: string;
  state: State;
  signal: string;
}

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "Public surfaces",
    rows: [
      { what: "Live site", cadence: "5 min", state: "seen", signal: "HTTP 200 — already covered" },
      { what: "Staging site", cadence: "5 min", state: "seen", signal: "HTTP 200 plus expected content" },
      { what: "Public API", cadence: "5 min", state: "seen", signal: "Response code check — already covered" },
      { what: "TLS certificates", cadence: "Auto-renew", state: "blind", signal: "Days to expiry; warn under 21. All three currently mid-October" },
    ],
  },
  {
    title: "UK supply — ingestion",
    rows: [
      { what: "Scraper boxes, individually", cadence: "6-hourly cycle", state: "part", signal: "Cars added per box in 6h. Per-box, not fleet total" },
      { what: "Housekeeper sweep", cadence: "Continuous", state: "blind", signal: "Cars re-checked per hour; oldest unchecked car's age" },
      { what: "Delisting cleaner", cadence: "Daily 06:30", state: "part", signal: "Live cars unseen over 6 days — cars:sweep-delist now reports and marks" },
      { what: "AutoTrader denials", cadence: "Per page", state: "part", signal: "S1 and the S4 backfill now log refusals; S2 and S3 still cannot report one" },
    ],
  },
  {
    title: "Irish prices — ingestion",
    rows: [
      { what: "Carzone weekly pipeline", cadence: "Mon 03:00", state: "part", signal: "Did Monday's run complete by Monday evening? Not simply how old the data is" },
      { what: "Carzone snapshot", cadence: "Weekly", state: "blind", signal: "Snapshot age measured against the 7-day cadence; ads scraped vs last week" },
      { what: "Pipeline stage completion", cadence: "Mon 03:00", state: "blind", signal: "All 8 stages reached; a resume should be an alert, not a silent rescue" },
    ],
  },
  {
    title: "Data quality — not covered by the panel above",
    rows: [
      { what: "Capture rates", cadence: "Per car", state: "seen", signal: "Already shown live in Data collection above — every field, with its per-hour rate" },
      { what: "Housekeeper throughput", cadence: "Continuous", state: "blind", signal: "Cars visited per hour. This is the ceiling on every repair" },
      { what: "End-to-end test suite", cadence: "On demand", state: "part", signal: "63 tests exist and pass; nothing runs them on a schedule yet" },
      { what: "Feature-pair search index", cadence: "15 min", state: "blind", signal: "Cars added in 24h still missing the index — this silently broke once before" },
      { what: "Prices exclude the inspection fee", cadence: "Per render", state: "blind", signal: "Assert card, filter and detail prices agree for a sample car" },
      { what: "Best Value claims hold", cadence: "Per render", state: "blind", signal: "Count of badged cars whose live saving is under the claim — target zero" },
      { what: "Banned-dealer screening", cadence: "Per car", state: "blind", signal: "Skips logged per hour. A sustained zero means the gate has failed open" },
    ],
  },
  {
    title: "Derived data — scheduled commands",
    rows: [
      { what: "Final price refresh", cadence: "5 min · full 03:30", state: "blind", signal: "Last success, rows touched, duration" },
      { what: "VRT flag sync", cadence: "15 min", state: "blind", signal: "Last success; count of cars pending VRT" },
      { what: "VRT allocator pipeline", cadence: "30 min", state: "part", signal: "Currently healthy. Needs last-success age, not just a log file" },
      { what: "Irish class medians", cadence: "Daily 05:30", state: "blind", signal: "Whether the rebuild tracked the newest Carzone snapshot after each Monday" },
      { what: "Incremental matcher", cadence: "Daily 05:00", state: "blind", signal: "Rows appended per night and watermark movement — a silent zero is the failure mode" },
      { what: "Currency rate", cadence: "03:00", state: "part", signal: "Rate age. Has failed silently for two days before" },
      { what: "Warranty eligibility", cadence: "5 min · full monthly", state: "blind", signal: "Last success; backlog awaiting derivation" },
    ],
  },
  {
    title: "Customers and money",
    rows: [
      { what: "Similar-car alerts", cadence: "5 min", state: "part", signal: "Now sent direct to members; weekly summary reports volume and recipients" },
      { what: "Saved-search alerts", cadence: "15 min", state: "part", signal: "Same — weekly summary, Mondays 08:15" },
      { what: "Promotion batches", cadence: "2 min", state: "blind", signal: "Queue depth and send rate" },
      { what: "Deposit funnel", cadence: "On demand", state: "blind", signal: "Sessions created vs paid per day; webhook failures" },
      { what: "Deposit confirmation email", cadence: "On payment", state: "blind", signal: "Send failures — currently swallowed by its own try/catch" },
      { what: "Outbound mail overall", cadence: "Continuous", state: "blind", signal: "Failure count per hour across every sender" },
    ],
  },
  {
    title: "Housekeeping and infrastructure",
    rows: [
      { what: "Five purge jobs", cadence: "15 min – daily", state: "blind", signal: "Last success each; rows removed" },
      { what: "Application process", cadence: "5 min", state: "seen", signal: "Already covered. Add restart count as a warning" },
      { what: "Disk", cadence: "5 min", state: "seen", signal: "Covered on the main server. Scraper boxes are not watched — one filled to 100% recently" },
      { what: "Database backups", cadence: "Undrilled", state: "blind", signal: "Age and size of newest backup, plus a restore drill" },
    ],
  },
];

const LABEL: Record<State, string> = { seen: "Watched", part: "Partial", blind: "Blind" };

export default function HealthRegister() {
  const all = GROUPS.flatMap((g) => g.rows);
  const counts = {
    seen: all.filter((r) => r.state === "seen").length,
    part: all.filter((r) => r.state === "part").length,
    blind: all.filter((r) => r.state === "blind").length,
  };

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelHeading}>What has to keep working</h2>
      <p className={styles.panelMeta}>
        Every recurring process and quality invariant in the build &mdash; {all.length} items.{" "}
        <strong>{counts.seen} watched</strong>, {counts.part} partial, {counts.blind} blind. A row is
        not about whether something is <em>down</em>; it is about whether it has quietly stopped being
        true.
      </p>

      <div className={styles.registerLegend}>
        <span><span className={`${styles.pill} ${styles.pillSeen}`}>Watched</span> covered by a check today</span>
        <span><span className={`${styles.pill} ${styles.pillPart}`}>Partial</span> visible only in aggregate or in a log</span>
        <span><span className={`${styles.pill} ${styles.pillBlind}`}>Blind</span> no visibility at all</span>
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.healthTable}>
          <thead>
            <tr>
              <th>Process or invariant</th>
              <th>Cadence</th>
              <th>Today</th>
              <th>Signal worth watching</th>
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((g) => (
              <>
                <tr key={g.title}>
                  <td colSpan={4} className={styles.registerGroup}>{g.title}</td>
                </tr>
                {g.rows.map((r) => (
                  <tr key={g.title + r.what}>
                    <td className={styles.streamLabel}>{r.what}</td>
                    <td className={styles.registerCadence}>{r.cadence}</td>
                    <td>
                      <span
                        className={`${styles.pill} ${
                          r.state === "seen" ? styles.pillSeen : r.state === "part" ? styles.pillPart : styles.pillBlind
                        }`}
                      >
                        {LABEL[r.state]}
                      </span>
                    </td>
                    <td className={styles.streamNote}>{r.signal}</td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.panelMeta}>
        Compiled 31 July 2026, updated as monitoring is built. Statuses are maintained by hand here;
        making them self-reporting is the pipeline-health table job.
      </p>
    </section>
  );
}
