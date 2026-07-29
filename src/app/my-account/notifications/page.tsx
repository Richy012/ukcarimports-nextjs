import type { Metadata } from "next";
import NotificationsClient from "./NotificationsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Notifications",
  description: "Cars we've sent you based on your saved cars and saved searches.",
};

export default function NotificationsPage() {
  return <NotificationsClient />;
}
