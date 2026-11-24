import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { diagnose, InputSchema } from "@/engine";
import { diagnoseProps } from "@/lib/analytics-events";
import { captureServer, distinctIdForIp } from "@/lib/posthog-server";
import { clientIp, rateLimit } from "./rateLimit";

export const runtime = "nodejs";
export const maxDuration = 30;

const PER_IP = { limit: 8, windowMs: 60_000 };
// Stops this API being used to hammer someone else's domain.
const PER_DOMAIN = { limit: 20, windowMs: 60_000 };

function tooMany(retryAfter: number, what: string) {
  return NextResponse.json(
    { error: `Too many requests${what}. Please try again in ${retryAfter}s.` },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

export async function POST(req: Request) {
  const ipRaw = clientIp(req);
  const distinctId = distinctIdForIp(ipRaw);
  const ip = rateLimit(`ip:${ipRaw}`, PER_IP.limit, PER_IP.windowMs);
  if (!ip.ok) {
    void captureServer(distinctId, "diagnose_rate_limited", { reason: "ip" });
    return tooMany(ip.retryAfter, "");
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    const input = InputSchema.parse(body);
    const dom = rateLimit(`domain:${input.domain}`, PER_DOMAIN.limit, PER_DOMAIN.windowMs);
    if (!dom.ok) {
      void captureServer(distinctId, "diagnose_rate_limited", { reason: "domain", domain: input.domain });
      return tooMany(dom.retryAfter, " for this domain");
    }
    // allowPrivate is never enabled on the hosted API (SSRF protection).
    const report = await diagnose(input, { allowPrivate: false });
    void captureServer(distinctId, "diagnose_completed", diagnoseProps(input, report));
    return NextResponse.json(report);
  } catch (e) {
    if (e instanceof ZodError) {
      void captureServer(distinctId, "diagnose_validation_error", { issue_count: e.issues.length });
      return NextResponse.json({ error: "Invalid input", issues: e.issues.map((i) => ({ path: i.path, message: i.message })) }, { status: 422 });
    }
    void captureServer(distinctId, "diagnose_failed", {});
    return NextResponse.json({ error: "Diagnosis failed" }, { status: 500 });
  }
}
