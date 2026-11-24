import { z } from "zod";
import { httpGet, errMsg } from "./net";
import { normalizeFingerprint } from "./match";
import type { CheckResult, DiagnoseInput, Options } from "./types";

const base = { module: "android" as const };

const Statement = z.object({
  relation: z.array(z.string()),
  target: z.object({
    namespace: z.string(),
    package_name: z.string().optional(),
    sha256_cert_fingerprints: z.array(z.string()).optional(),
  }).passthrough(),
}).passthrough();

export function analyzeAssetLinks(body: string, input: DiagnoseInput): CheckResult[] {
  let json: unknown;
  try { json = JSON.parse(body); } catch (e) {
    return [{ ...base, id: "al.json", title: "assetlinks.json JSON", status: "fail",
      message: "File is not valid JSON.", evidence: errMsg(e),
      fix: "Serve a JSON array of statements; check the server isn't returning an HTML page." }];
  }
  const parsed = z.array(Statement).safeParse(json);
  if (!parsed.success) {
    return [{ ...base, id: "al.schema", title: "assetlinks.json structure", status: "fail",
      message: "Not a valid statement list.",
      evidence: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"),
      fix: 'Expected [{"relation":["delegate_permission/common.handle_all_urls"],"target":{"namespace":"android_app","package_name":"com.example","sha256_cert_fingerprints":["AA:BB:..."]}}]' }];
  }
  const out: CheckResult[] = [{ ...base, id: "al.schema", title: "assetlinks.json structure", status: "pass",
    message: `Valid with ${parsed.data.length} statement(s).` }];

  const apps = parsed.data.filter((s) => s.target.namespace === "android_app");
  const withRelation = apps.filter((s) => s.relation.includes("delegate_permission/common.handle_all_urls"));
  if (apps.length && !withRelation.length) {
    out.push({ ...base, id: "al.relation", title: "handle_all_urls relation", status: "fail",
      message: "No android_app statement grants delegate_permission/common.handle_all_urls.",
      fix: 'Add "delegate_permission/common.handle_all_urls" to the relation array.' });
  }

  if (!input.androidPackage) {
    out.push({ ...base, id: "al.package", title: "Package match", status: "info",
      message: "No package name provided; skipped match.",
      evidence: `Listed: ${apps.map((a) => a.target.package_name).join(", ") || "(none)"}` });
    return out;
  }
  const pkgStmts = withRelation.filter((s) => s.target.package_name === input.androidPackage);
  if (!pkgStmts.length) {
    out.push({ ...base, id: "al.package", title: "Package match", status: "fail",
      message: `Package "${input.androidPackage}" is not listed.`,
      evidence: `Listed: ${apps.map((a) => a.target.package_name).join(", ") || "(none)"}`,
      fix: `Add a statement whose target.package_name is exactly "${input.androidPackage}" (your applicationId, not necessarily the namespace).` });
    return out;
  }
  out.push({ ...base, id: "al.package", title: "Package match", status: "pass", message: `${input.androidPackage} is listed.` });

  const listed = pkgStmts.flatMap((s) => s.target.sha256_cert_fingerprints ?? []);
  const listedNorm = new Set<string>();
  for (const fp of listed) {
    const n = normalizeFingerprint(fp);
    if (!n) out.push({ ...base, id: `al.fpformat:${fp}`, title: "Fingerprint format", status: "fail",
      message: "Malformed SHA-256 fingerprint in assetlinks.json.", evidence: fp,
      fix: "Use 32 colon-separated hex bytes (95 characters), e.g. from `keytool -list -v`." });
    else listedNorm.add(n);
  }
  if (!input.androidFingerprints.length) {
    out.push({ ...base, id: "al.fp", title: "Signing fingerprint", status: "info",
      message: "No fingerprint provided; skipped match.", evidence: `Listed: ${[...listedNorm].join("\n")}`,
      fix: "Provide your release (and Play App Signing) SHA-256 fingerprint to verify." });
    return out;
  }
  for (const raw of input.androidFingerprints) {
    const n = normalizeFingerprint(raw);
    if (!n) {
      out.push({ ...base, id: `al.fp:${raw}`, title: "Signing fingerprint", status: "fail",
        message: "Provided fingerprint is not a valid SHA-256.", evidence: raw,
        fix: "Run `keytool -list -v -keystore <keystore>` and copy the SHA256 line." });
    } else if (listedNorm.has(n)) {
      out.push({ ...base, id: `al.fp:${n}`, title: "Signing fingerprint", status: "pass",
        message: "Fingerprint is listed.", evidence: n });
    } else {
      out.push({ ...base, id: `al.fp:${n}`, title: "Signing fingerprint", status: "fail",
        message: "Fingerprint is not listed for this package.",
        evidence: `Provided: ${n}\nListed: ${[...listedNorm].join("\n") || "(none)"}`,
        fix: "If you use Play App Signing, add the *app signing key* SHA-256 from Play Console > App integrity (not just your upload key). Add debug fingerprints separately for local testing." });
    }
  }
  return out;
}

export async function checkAndroid(input: DiagnoseInput, opts: Options): Promise<CheckResult[]> {
  const url = `https://${input.domain}/.well-known/assetlinks.json`;
  let res;
  try {
    res = await httpGet(url, { allowPrivate: opts.allowPrivate, timeoutMs: opts.timeoutMs });
  } catch (e) {
    return [{ ...base, id: "al.fetch", title: "assetlinks.json reachable", status: "fail",
      message: "Could not fetch assetlinks.json.", evidence: `${url}\n${errMsg(e)}` }];
  }
  if (res.status >= 300 && res.status < 400) {
    return [{ ...base, id: "al.fetch", title: "assetlinks.json reachable", status: "fail",
      message: `Request redirected (${res.status}).`, evidence: `${url} -> ${res.headers.location}`,
      fix: "Android's verifier does not follow redirects for assetlinks.json. Serve it directly with HTTP 200." }];
  }
  if (res.status !== 200) {
    return [{ ...base, id: "al.fetch", title: "assetlinks.json reachable", status: "fail",
      message: `Received HTTP ${res.status}.`, evidence: url,
      fix: "Host the file at /.well-known/assetlinks.json and return 200." }];
  }
  const out: CheckResult[] = [{ ...base, id: "al.fetch", title: "assetlinks.json reachable", status: "pass",
    message: "Fetched with HTTP 200 and no redirects.", evidence: url }];
  const ct = String(res.headers["content-type"] ?? "");
  if (!/application\/json/i.test(ct)) out.push({ ...base, id: "al.ctype", title: "assetlinks content-type", status: "warn",
    message: `Content-Type is "${ct || "missing"}", expected application/json.`,
    fix: "Serve with Content-Type: application/json." });
  const hints = input.campaigns.map((c) => ({
    ...base,
    id: `campaign.android:${c.path}`,
    title: "Campaign link (Android)",
    status: "info" as const,
    message: "assetlinks.json does not define per-path rules. Confirm your app's intent filter covers this path.",
    evidence: c.label,
    fix: "In AndroidManifest, ensure the autoVerify VIEW intent filter's pathPrefix or pathPattern includes this campaign path.",
  }));
  return [...out, ...analyzeAssetLinks(res.body, input), ...hints];
}
