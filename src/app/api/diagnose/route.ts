import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { diagnose } from "@/engine";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    // allowPrivate is never enabled on the hosted API (SSRF protection).
    return NextResponse.json(await diagnose(body as any, { allowPrivate: false }));
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ error: "Invalid input", issues: e.issues.map((i) => ({ path: i.path, message: i.message })) }, { status: 422 });
    }
    return NextResponse.json({ error: "Diagnosis failed" }, { status: 500 });
  }
}
