import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/apiProxy";

// Close a finished deposit: the car is delivered, so the row moves to
// deposit_payments_archive and leaves the live list. No Stripe call, no money
// moved — this exists so a delivered deal cannot be refunded by mistake
// (owner, 2026-09-10).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyRequest(req, `/user/admin-deposit-close/${id}`);
}
