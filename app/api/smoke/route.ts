import { NextResponse } from "next/server";
import { runSmoke } from "@/lib/smoke";

// Reads source files / may call an external LLM — always run dynamically.
export const dynamic = "force-dynamic";

/**
 * GET /api/smoke[?llm=0]
 * Returns the structured smoke report (profile + optional LLM completion).
 * Always 200 with a structured body; failures are reported in the payload.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const withLLM = url.searchParams.get("llm") !== "0";
  const report = await runSmoke({ withLLM });
  return NextResponse.json(report);
}
