import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/apiProxy";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyRequest(req, `/user/saved-searches/${id}`);
}

// Ladder (2026-09-03): members change the saving threshold on a saved search
// from their account page; the API's updateSavedSearch takes the full params.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyRequest(req, `/user/saved-searches/${id}`);
}
