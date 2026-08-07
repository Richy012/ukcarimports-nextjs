import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/apiProxy";

// Owner go/no-go per garage. Nothing collects without this.
export async function POST(req: NextRequest) {
  return proxyRequest(req, "/user/admin-dealer-approve");
}
