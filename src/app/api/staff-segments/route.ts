import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/apiProxy";

// Same-origin proxy: Cloudflares api-cors-backstop blocks direct browser calls.
export async function GET(req: NextRequest) {
  const qs = req.nextUrl.search;
  return proxyRequest(req, `/user/admin-segments${qs}`);
}
