import { NextResponse } from "next/server";
import { runDiscovery } from "@/lib/aggregation/discover";

// Hits external sources (network) + writes SQLite — always run dynamically.
export const dynamic = "force-dynamic";
// A full crawl can take a while (pagination + throttling).
export const maxDuration = 120;

/**
 * GET /api/discover[?keywords=a,b][&departments=75,92][&limit=50]
 * Runs an on-demand discovery pass and returns the ranked offers + run summary.
 * Always 200 with a structured body; per-source failures are reported inside.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const split = (v: string | null) =>
    v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  const limitParam = url.searchParams.get("limit");
  const result = await runDiscovery({
    keywords: split(url.searchParams.get("keywords")),
    departments: split(url.searchParams.get("departments")),
    limit: limitParam ? Number(limitParam) : undefined,
  });
  return NextResponse.json(result);
}
