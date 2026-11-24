/** A campaign link or path to test against AASA (and flag Android intent-filter gaps). */
export type CampaignTarget = {
  /** Pathname plus optional `?query` for AASA component matching */
  path: string;
  /** Original input, shown in the report */
  label: string;
  /** Set when the user pasted a full URL */
  urlHost?: string;
};

export function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/:\d+$/, "");
}

/** Parse one line: full https campaign URL or a path (optionally with ?query). */
export function parseCampaignEntry(raw: string, _diagnoseDomain: string): CampaignTarget {
  const line = raw.trim();
  if (!line) throw new Error("Empty campaign URL or path");

  if (/^https?:\/\//i.test(line)) {
    let u: URL;
    try {
      u = new URL(line);
    } catch {
      throw new Error(`Invalid URL: ${line}`);
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error("Campaign URL must use http or https");
    }
    const pathname = u.pathname || "/";
    const qs = u.search ? u.search.slice(1) : "";
    const path = qs ? `${pathname}?${qs}` : pathname;
    const label = line.length > 160 ? `${line.slice(0, 157)}…` : line;
    return { path, label, urlHost: normalizeHost(u.hostname) };
  }

  if (!line.startsWith("/")) {
    throw new Error("Use a full https:// campaign URL or a path starting with /");
  }

  const path = line.split("#")[0];
  return { path, label: path.length > 160 ? `${path.slice(0, 157)}…` : path };
}

export function campaignHostsMatch(diagnoseDomain: string, urlHost: string): boolean {
  const d = normalizeHost(diagnoseDomain.split(":")[0] ?? diagnoseDomain);
  return normalizeHost(urlHost) === d;
}