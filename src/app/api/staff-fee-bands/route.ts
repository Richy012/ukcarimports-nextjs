import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/apiProxy";

export async function GET(req: NextRequest) {
  return proxyRequest(req, "/user/fee-bands");
}

export async function POST(req: NextRequest) {
  return proxyRequest(req, "/user/fee-bands");
}
