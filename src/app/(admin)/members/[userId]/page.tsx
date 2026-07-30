import type { Metadata } from "next";
import MemberDetailClient from "./MemberDetailClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Member detail",
  robots: { index: false, follow: false },
};

export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <MemberDetailClient userId={userId} />;
}
