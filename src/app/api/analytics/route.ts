import { NextResponse } from "next/server";
import { z } from "zod";
import { captureServer, distinctIdForIp } from "@/lib/posthog-server";
import { clientIp, rateLimit } from "../diagnose/rateLimit";

export const runtime = "nodejs";

const ALLOWED = new Set([
  "pageview",
  "sample_report_viewed",
  "diagnose_submitted",
  "diagnose_client_error",
]);

const Body = z.object({
  event: z.string().min(1).max(64),
  distinctId: z.string().uuid().optional(),
  properties: z
    .record(z.string().max(64), z.union([z.string().max(200), z.number(), z.boolean()]))
    .optional(),
});

export async function POST(req: Request) {
  const ip = rateLimit(`analytics:${clientIp(req)}`, 30, 60_000);
  if (!ip.ok) return new NextResponse(null, { status: 204 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success || !ALLOWED.has(parsed.data.event)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const distinctId = parsed.data.distinctId ?? distinctIdForIp(clientIp(req));
  void captureServer(distinctId, parsed.data.event, parsed.data.properties ?? {});
  return new NextResponse(null, { status: 204 });
}