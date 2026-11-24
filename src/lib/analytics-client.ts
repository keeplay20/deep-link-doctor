const ID_KEY = "dld_anon_id";

function anonId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

/** Sends UI events through the server so the PostHog key stays private. */
export function captureClient(
  event: string,
  properties?: Record<string, string | number | boolean | undefined>,
): void {
  const distinctId = anonId();
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, distinctId, properties }),
    keepalive: true,
  }).catch(() => {});
}