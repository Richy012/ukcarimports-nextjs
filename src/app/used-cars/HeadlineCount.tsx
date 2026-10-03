"use client";

// Website review 3 Oct 2026 #33: the headline ("Total vehicles: 130,695") came from the server render -- up to four
// hours old under the edge cache -- while the live line under Apply said "130,762 vehicles match". The headline now
// follows the live count FilterBar publishes, so the page shows one number. The server figure stays in the HTML for
// crawlers and for the moment before the live count lands. `pageKey` pairs a headline with its own FilterBar, so a
// figure from the page the visitor just left can never show here.
import { useSyncExternalStore } from "react";

type Snap = { key: string; count: number; filtered: boolean } | null;

let snap: Snap = null;
const listeners = new Set<() => void>();

export function publishHeadlineCount(next: Snap) {
  snap = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export default function HeadlineCount({
  initial,
  isDefaultView,
  pageKey,
  className,
}: {
  initial: number | null;
  isDefaultView: boolean;
  pageKey: string;
  className?: string;
}) {
  const live = useSyncExternalStore(subscribe, () => snap, () => null);
  const mine = live && live.key === pageKey ? live : null;
  const count = mine ? mine.count : initial;
  if (count === null || count === undefined) return null;
  const filtered = mine ? mine.filtered : !isDefaultView;
  return (
    <p className={className}>
      {filtered ? "Vehicles matching your filters" : "Total vehicles"}: {count.toLocaleString("en-IE")}
    </p>
  );
}
