"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

// A chip that navigates like a link but is not one. The year and fuel chips
// on every /import/<make>/<model> page used to be <a href="/used-cars?Make=
// ...&minYear=..."> - about 13 per page across ~400 pages, and the source of
// the 20,000+ "duplicate without canonical" filter URLs Google was fetching
// (1 Oct 2026 review). A button has no href, so a crawler has nothing to
// follow; a visitor gets exactly the same filtered list.
export default function ChipLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <button type="button" className={className} onClick={() => router.push(href)}>
      {children}
    </button>
  );
}
