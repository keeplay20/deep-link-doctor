import { createHash } from "node:crypto";
import { PostHog } from "posthog-node";

let client: PostHog | null = null;

function apiKey(): string | undefined {
  return process.env.POSTHOG_KEY;
}

function apiHost(): string {
  return process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";
}

function getClient(): PostHog | null {
  const key = apiKey();
  if (!key) return null;
  client ??= new PostHog(key, { host: apiHost(), flushAt: 1, flushInterval: 0 });
  return client;
}

/** Stable anonymous id per IP (not stored raw in analytics). */
export function distinctIdForIp(ip: string): string {
  return `ip_${createHash("sha256").update(ip).digest("hex").slice(0, 20)}`;
}

export async function captureServer(
  distinctId: string,
  event: string,
  properties: Record<string, string | number | boolean | undefined>,
): Promise<void> {
  const ph = getClient();
  if (!ph) return;
  ph.capture({ distinctId, event, properties: properties as Record<string, unknown> });
  await ph.flush();
}