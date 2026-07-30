import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/apiProxy";

// Upstream route really is capital-Q "delete-Query" (legacy naming).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyRequest(req, `/user/delete-Query/${id}`);
}
