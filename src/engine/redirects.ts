import { httpGet, errMsg } from "./net";
import type { CheckResult, DiagnoseInput, Options } from "./types";

export interface Hop { url: string; status: number; location?: string }

export async function followChain(start: string, opts: Options, max = 10): Promise<{ hops: Hop[]; error?: string }> {
  const hops: Hop[] = [];
  let url = start;
  for (let i = 0; i < max; i++) {
    try {
      const r = await httpGet(url, { allowPrivate: opts.allowPrivate, timeoutMs: opts.timeoutMs, maxBytes: 1024 });
      const loc = r.headers.location;
      hops.push({ url, status: r.status, location: loc });
      if (r.status >= 300 && r.status < 400 && loc) { url = new URL(loc, url).toString(); continue; }
      return { hops };
    } catch (e) {
      return { hops, error: errMsg(e) };
    }
  }
  return { hops, error: `More than ${max} redirects (possible loop)` };
}

export async function checkRedirects(input: DiagnoseInput, opts: Options): Promise<CheckResult[]> {
  const base = { module: "redirects" as const };
  const out: CheckResult[] = [];
  const fmt = (h: Hop[]) => h.map((x) => `${x.status} ${x.url}`).join("\n  -> ");

  const https = await followChain(`https://${input.domain}/`, opts);
  const redirects = https.hops.length - 1;
  if (https.error && !https.hops.length) {
    out.push({ ...base, id: "redir.https", title: "Homepage reachability", status: "fail",
      message: "https://" + input.domain + "/ is unreachable.", evidence: https.error });
  } else if (https.error) {
    out.push({ ...base, id: "redir.https", title: "Redirect chain (HTTPS)", status: "fail",
      message: "Redirect chain failed.", evidence: `${fmt(https.hops)}\n${https.error}`,
      fix: "Remove redirect loops and ensure the final URL returns 200." });
  } else {
    const last = https.hops[https.hops.length - 1];
    const crossHost = https.hops.some((h) => new URL(h.url).host !== input.domain);
    const status = last.status >= 400 ? "fail" : redirects > 2 ? "warn" : "pass";
    out.push({ ...base, id: "redir.https", title: "Redirect chain (HTTPS)", status,
      message: redirects === 0 ? `No redirects; responds ${last.status}.`
        : `${redirects} redirect(s)${crossHost ? ", leaves the original host" : ""}; final status ${last.status}.`,
      evidence: fmt(https.hops),
      fix: status === "pass" ? undefined : "Keep redirect chains short. Universal Links/App Links only apply to the exact host a link uses, so redirecting to another host (e.g. apex -> www) means the app must be associated with the final host too." });
  }

  const plain = await followChain(`http://${input.domain}/`, opts);
  if (plain.hops.length) {
    const first = plain.hops[0];
    const upgrades = first.status >= 300 && first.status < 400 && first.location?.startsWith("https://");
    out.push({ ...base, id: "redir.http", title: "HTTP to HTTPS upgrade",
      status: upgrades ? "pass" : first.status < 400 ? "warn" : "info",
      message: upgrades ? "HTTP redirects to HTTPS." : "HTTP does not redirect to HTTPS.",
      evidence: fmt(plain.hops),
      fix: upgrades ? undefined : "Redirect http:// to https:// so links shared without a scheme still land on the verified origin." });
  } else {
    out.push({ ...base, id: "redir.http", title: "HTTP to HTTPS upgrade", status: "info",
      message: "Port 80 not reachable.", evidence: plain.error });
  }
  return out;
}
