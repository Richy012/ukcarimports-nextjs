import type { Metadata } from "next";
import MembersClient from "./MembersClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Members",
  robots: { index: false, follow: false },
};

export default function AdminMembersPage() {
  return <MembersClient />;
}
