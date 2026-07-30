import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/apiProxy";

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return proxyRequest(req, `/user/members/${userId}/notifications`);
}
