import { z } from "zod";
import { httpGet, errMsg } from "./net";
import { globMatch } from "./match";
import { campaignHostsMatch } from "./campaign";
import type { CheckResult, DiagnoseInput, Options } from "./types";

const base = { module: "ios" as const };

const Component = z.object({
  "/": z.string().optional(),
  "?": z.union([z.string(), z.record(z.string(), z.string())]).optional(),
  "#": z.string().optional(),
  exclude: z.boolean().optional(),
}).passthrough();

const Detail = z.object({
  appID: z.string().optional(),
  appIDs: z.array(z.string()).optional(),
  paths: z.array(z.string()).optional(),
  components: z.array(Component).optional(),
}).passthrough();

const Aasa = z.object({
  applinks: z.object({
    apps: z.array(z.unknown()).optional(),
    details: z.array(Detail).optional(),
  }).passthrough().optional(),
}).passthrough();

export type PathVerdict = { matched: boolean; rule?: string };

/** Evaluate a path against one AASA detail. First matching rule wins; exclusions block. */
export function evaluatePath(detail: z.infer<typeof Detail>, path: string): PathVerdict {
  const [pathname, rest = ""] = path.split("#")[0].split(/\?(.*)/s);
  if (detail.components) {
    for (const c of detail.components) {
      if (c["/"] !== undefined && !globMatch(c["/"], pathname)) continue;
      if (typeof c["?"] === "string" && !globMatch(c["?"], rest)) continue;
      if (c["?"] && typeof c["?"] === "object") {
        const params = new URLSearchParams(rest);
        if (!Object.entries(c["?"]).every(([k, v]) => params.has(k) && globMatch(v, params.get(k)!))) continue;
      }
      return { matched: !c.exclude, rule: JSON.stringify(c) };
    }
    return { matched: false };
  }
  for (const p of detail.paths ?? ["*"]) {
    const exclude = p.startsWith("NOT ");
    if (globMatch(exclude ? p.slice(4) : p, pathname)) return { matched: !exclude, rule: p };
  }
  return { matched: false };
}

export function analyzeAasa(body: string, input: DiagnoseInput): CheckResult[] {
  const out: CheckResult[] = [];
  let json: unknown;
  try { json = JSON.parse(body); } catch (e) {
    return [{ ...base, id: "aasa.json", title: "AASA JSON", status: "fail",
      message: "File is not valid JSON.", evidence: errMsg(e),
      fix: "Serve plain JSON. AASA must not be signed/wrapped; check your server isn't returning an HTML error page." }];
  }
  const parsed = Aasa.safeParse(json);
  if (!parsed.success || !parsed.data.applinks) {
    return [{ ...base, id: "aasa.schema", title: "AASA structure", status: "fail",
      message: "Missing or invalid `applinks` key.",
      evidence: parsed.success ? undefined : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"),
      fix: 'Expected {"applinks":{"details":[{"appIDs":["TEAMID.bundle.id"],"components":[{"/":"/path/*"}]}]}}' }];
  }
  const details = parsed.data.applinks.details ?? [];
  out.push({ ...base, id: "aasa.schema", title: "AASA structure", status: details.length ? "pass" : "fail",
    message: details.length ? `Valid structure with ${details.length} detail entr${details.length === 1 ? "y" : "ies"}.` : "`applinks.details` is empty or missing.",
    fix: details.length ? undefined : "Add at least one entry to applinks.details." });
  if (!details.length) return out;

  const ids = details.flatMap((d) => [...(d.appIDs ?? []), ...(d.appID ? [d.appID] : [])]);
  const mine = input.iosAppId
    ? details.filter((d) => [...(d.appIDs ?? []), ...(d.appID ? [d.appID] : [])].includes(input.iosAppId!))
    : [];

  if (!input.iosAppId) {
    out.push({ ...base, id: "aasa.appid", title: "App ID match", status: "info",
      message: "No iOS App ID provided; skipped match.", evidence: `Listed: ${ids.join(", ")}`,
      fix: "Provide TEAMID.bundleId to verify it is listed." });
    if (input.campaigns.length) {
      out.push({ ...base, id: "aasa.campaign", title: "Campaign links", status: "info",
        message: "Campaign URLs provided but iOS App ID missing — AASA path rules were not evaluated.",
        evidence: input.campaigns.map((c) => c.label).join("\n"),
        fix: "Add your TEAMID.bundleId to see whether each campaign link is matched or excluded in AASA." });
    }
    return out;
  }
  if (!mine.length) {
    const [team, ...bundle] = input.iosAppId.split(".");
    const sameBundle = ids.find((i) => i.split(".").slice(1).join(".") === bundle.join("."));
    const sameTeam = ids.find((i) => i.split(".")[0] === team);
    out.push({ ...base, id: "aasa.appid", title: "App ID match", status: "fail",
      message: sameBundle ? "Bundle ID is listed but Team ID differs." : sameTeam ? "Team ID is listed but Bundle ID differs." : "App ID is not listed in the AASA file.",
      evidence: `Expected: ${input.iosAppId}\nListed: ${ids.join(", ") || "(none)"}`,
      fix: `Add "${input.iosAppId}" to appIDs. Find the Team ID in Apple Developer > Membership; the bundle ID must match Xcode exactly (case-sensitive).` });
    return out;
  }
  out.push({ ...base, id: "aasa.appid", title: "App ID match", status: "pass",
    message: `${input.iosAppId} is listed.` });

  for (const c of input.campaigns) {
    if (c.urlHost && !campaignHostsMatch(input.domain, c.urlHost)) {
      out.push({ ...base, id: `campaign.host:${c.path}`, title: "Campaign host", status: "warn",
        message: `Link host (${c.urlHost}) differs from the domain you entered (${input.domain.split(":")[0]}).`,
        evidence: c.label,
        fix: `Universal Links apply per host. Re-run diagnostics with domain ${c.urlHost}, or use campaign links on ${input.domain}.` });
    }
    const verdicts = mine.map((d) => evaluatePath(d, c.path));
    const hit = verdicts.find((v) => v.matched);
    const excluded = verdicts.find((v) => !v.matched && v.rule);
    const pathname = c.path.split("?")[0]!;
    out.push({ ...base, id: `aasa.path:${c.path}`, title: `Campaign link`,
      status: hit ? "pass" : "fail",
      message: hit ? "Opens the app via Universal Links." : excluded ? "Explicitly excluded by an AASA rule." : "No AASA rule matches this campaign path.",
      evidence: `${c.label}\n${hit?.rule ?? excluded?.rule ?? "(no matching rule)"}`,
      fix: hit ? undefined : `Add a component such as {"/":"${pathname.split("/").slice(0, 2).join("/") || "/"}/*"} (or remove the exclusion).` });
  }
  return out;
}

export async function checkIos(input: DiagnoseInput, opts: Options): Promise<CheckResult[]> {
  if (!input.iosAppId && input.paths.length === 0) {
    // still check file presence
  }
  const url = `https://${input.domain}/.well-known/apple-app-site-association`;
  let res;
  try {
    res = await httpGet(url, { allowPrivate: opts.allowPrivate, timeoutMs: opts.timeoutMs });
  } catch (e) {
    return [{ ...base, id: "aasa.fetch", title: "AASA reachable", status: "fail",
      message: "Could not fetch the AASA file.", evidence: `${url}\n${errMsg(e)}` }];
  }
  if (res.status >= 300 && res.status < 400) {
    return [{ ...base, id: "aasa.fetch", title: "AASA reachable", status: "fail",
      message: `AASA request redirected (${res.status}).`, evidence: `${url} -> ${res.headers.location}`,
      fix: "Apple's CDN does not follow redirects for the AASA file. Serve it directly at /.well-known/apple-app-site-association with HTTP 200." }];
  }
  if (res.status !== 200) {
    return [{ ...base, id: "aasa.fetch", title: "AASA reachable", status: "fail",
      message: `Received HTTP ${res.status}.`, evidence: url,
      fix: "Host the file at /.well-known/apple-app-site-association (no extension) and return 200." }];
  }
  const out: CheckResult[] = [{ ...base, id: "aasa.fetch", title: "AASA reachable", status: "pass",
    message: "Fetched with HTTP 200 and no redirects.", evidence: url }];
  const ct = String(res.headers["content-type"] ?? "");
  out.push(/application\/json/i.test(ct)
    ? { ...base, id: "aasa.ctype", title: "AASA content-type", status: "pass", message: `Content-Type: ${ct}` }
    : { ...base, id: "aasa.ctype", title: "AASA content-type", status: "warn",
        message: `Content-Type is "${ct || "missing"}", expected application/json.`,
        fix: "Serve the file with Content-Type: application/json." });
  if (res.truncated) out.push({ ...base, id: "aasa.size", title: "AASA size", status: "fail",
    message: "File exceeds the size limit.", fix: "Apple limits AASA to 128 KB." });
  return [...out, ...analyzeAasa(res.body, input)];
}
