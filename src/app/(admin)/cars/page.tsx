import type { Metadata } from "next";
import AdminCarsClient from "./AdminCarsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cars",
  robots: { index: false, follow: false },
};

export default function AdminCarsPage() {
  return <AdminCarsClient />;
}
