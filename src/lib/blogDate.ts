// One date format on the blog (website review 3 Oct 2026 #65). The CMS holds
// recent posts as "October 2, 2026" and older ones as "2026-06-05"; both render
// as "October 2, 2026", the format of every recent post, with the ISO date for
// <time dateTime>. Anything unrecognised is shown exactly as stored.
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthNumber(name: string): number {
  const k = name.slice(0, 3).toLowerCase();
  return MONTHS.findIndex((m) => m.slice(0, 3).toLowerCase() === k) + 1;
}

export function blogDate(raw: string | null | undefined): { label: string; iso?: string } {
  const s = (raw ?? "").trim();
  let y = 0;
  let m = 0;
  let d = 0;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const us = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
  const eu = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?,?\s+(\d{4})$/);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else if (us) {
    m = monthNumber(us[1]);
    d = Number(us[2]);
    y = Number(us[3]);
  } else if (eu) {
    d = Number(eu[1]);
    m = monthNumber(eu[2]);
    y = Number(eu[3]);
  }
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return { label: s };
  const pad = (n: number) => String(n).padStart(2, "0");
  return { label: `${MONTHS[m - 1]} ${d}, ${y}`, iso: `${y}-${pad(m)}-${pad(d)}` };
}
