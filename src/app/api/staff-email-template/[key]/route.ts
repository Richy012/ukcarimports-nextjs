import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/apiProxy";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return proxyRequest(req, `/user/admin-email-template/${key}`);
}
