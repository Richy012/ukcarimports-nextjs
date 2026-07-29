import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/apiProxy";

export async function POST(req: NextRequest) {
  return proxyRequest(req, "/payment-carsourcing");
}
