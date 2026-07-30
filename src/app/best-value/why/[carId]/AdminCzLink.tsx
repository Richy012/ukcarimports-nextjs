"use client";

// The raw Carzone URL is owner/admin audit material — never shown to
// customers (no outbound links to a competitor marketplace), but essential
// for verifying a match by eye when logged in as admin.
import { useEffect, useState } from "react";
import { getStaffToken } from "@/lib/auth";

export default function AdminCzLink({ url }: { url: string | null }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(Boolean(getStaffToken()));
  }, []);
  if (!show || !url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer noopener">
      ad ↗
    </a>
  );
}
