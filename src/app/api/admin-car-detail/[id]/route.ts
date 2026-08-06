import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/apiProxy";

// Staff-only car detail. The public car page uses this to show the
// seller/garage to an admin without the value ever entering the page itself:
// passing it as a server-component prop serialised it into the RSC payload,
// where anyone viewing source could read it. The proxy forwards the staff
// token and the API answers 403 without a valid admin one.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyRequest(req, "/user/admin-car-detail/" + encodeURIComponent(id));
}
