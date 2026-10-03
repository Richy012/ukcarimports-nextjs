import { NextRequest, NextResponse } from "next/server";

// Same-origin proxy: is this car reserved (a deposit held or paid)? Never cached - it changes the moment a deposit lands.
const API_BASE = "https://api.ukcarimports.ie/public";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const res = await fetch(`${API_BASE}/car-reserved/${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json({ reserved: Boolean(data?.reserved) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ reserved: false }, { headers: { "Cache-Control": "no-store" } });
  }
}
