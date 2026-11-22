import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { diagnose, InputSchema } from "@/engine";
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
  const ip = rateLimit(`ip:${clientIp(req)}`, PER_IP.limit, PER_IP.windowMs);
  if (!ip.ok) return tooMany(ip.retryAfter, "");

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    const input = InputSchema.parse(body);
    const dom = rateLimit(`domain:${input.domain}`, PER_DOMAIN.limit, PER_DOMAIN.windowMs);
    if (!dom.ok) return tooMany(dom.retryAfter, " for this domain");
    // allowPrivate is never enabled on the hosted API (SSRF protection).
    return NextResponse.json(await diagnose(input, { allowPrivate: false }));
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Invalid input", issues: e.issues.map((i) => ({ path: i.path, message: i.message })) }, { status: 422 });
    }
    return NextResponse.json({ error: "Diagnosis failed" }, { status: 500 });
  }
}
