import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/apiProxy";

/**
 * Records an arrival from one of our own social adverts.
 *
 * Proxies to the API like every other data path here -- the Next app has no
 * database connection of its own, and adding one for tracking would be the
 * wrong place to introduce it.
 */
export async function POST(req: NextRequest) {
  return proxyRequest(req, "/social-click");
}
