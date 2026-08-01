import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/apiProxy";

// Same-origin proxy: Cloudflare's api-cors-backstop rule blocks browser calls
// from staging straight to api.ukcarimports.ie.
export async function GET(req: NextRequest) {
  return proxyRequest(req, "/user/admin-collection-health");
}
