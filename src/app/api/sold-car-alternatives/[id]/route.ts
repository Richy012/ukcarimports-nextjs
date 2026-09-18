import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/apiProxy";

// Alternatives for a car that has already sold. Called by the /car/{id}
// not-found page, which cannot reach api.ukcarimports.ie from the browser
// (Cloudflare's api-cors-backstop rule), so it goes same-origin like the rest.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyRequest(req, `/sold-car-alternatives/${id}`);
}
