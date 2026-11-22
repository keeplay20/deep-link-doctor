import type { Report } from "@/engine/types";

/** Static, clearly-labelled sample used for screenshots and demos. Not a live scan. */
export const sampleReport: Report = {
  domain: "example.com",
  generatedAt: "2026-01-01T00:00:00.000Z",
  summary: { pass: 9, fail: 3, warn: 1, info: 0 },
  results: [
    { id: "dns.resolve", module: "domain", title: "DNS resolution", status: "pass", message: "Resolves to 2 address(es).", evidence: "93.184.216.34, 2606:2800:220:1::1" },
    { id: "tls.valid", module: "domain", title: "SSL certificate", status: "pass", message: "Valid certificate, expires in 74 days.", evidence: "Issuer: Let's Encrypt; expires Mar 20 2026" },
    { id: "redir.https", module: "redirects", title: "Redirect chain (HTTPS)", status: "warn",
      message: "3 redirect(s), leaves the original host; final status 200.",
      evidence: "301 https://example.com/\n  -> 302 https://www.example.com/\n  -> 301 https://www.example.com/en/\n  -> 200 https://www.example.com/en/home",
      fix: "Keep redirect chains short. Universal Links/App Links only apply to the exact host a link uses, so redirecting to another host (e.g. apex -> www) means the app must be associated with the final host too." },
    { id: "redir.http", module: "redirects", title: "HTTP to HTTPS upgrade", status: "pass", message: "HTTP redirects to HTTPS." },
    { id: "aasa.fetch", module: "ios", title: "AASA reachable", status: "pass", message: "Fetched with HTTP 200 and no redirects.", evidence: "https://example.com/.well-known/apple-app-site-association" },
    { id: "aasa.ctype", module: "ios", title: "AASA content-type", status: "pass", message: "Content-Type: application/json" },
    { id: "aasa.schema", module: "ios", title: "AASA structure", status: "pass", message: "Valid structure with 1 detail entry." },
    { id: "aasa.appid", module: "ios", title: "App ID match", status: "fail",
      message: "Team ID is listed but Bundle ID differs.",
      evidence: "Expected: ABCDE12345.com.example.app\nListed: ABCDE12345.com.example.app.staging",
      fix: 'Add "ABCDE12345.com.example.app" to appIDs. The bundle ID must match Xcode exactly (case-sensitive).' },
    { id: "aasa.path:/product/123", module: "ios", title: "Path /product/123", status: "pass", message: "Opens the app via Universal Links.", evidence: '{"/":"/product/*"}' },
    { id: "aasa.path:/admin/users", module: "ios", title: "Path /admin/users", status: "fail",
      message: "Explicitly excluded by an AASA rule.", evidence: '{"/":"/admin/*","exclude":true}',
      fix: "Remove the exclusion if this path should open the app." },
    { id: "al.fetch", module: "android", title: "assetlinks.json reachable", status: "pass", message: "Fetched with HTTP 200 and no redirects.", evidence: "https://example.com/.well-known/assetlinks.json" },
    { id: "al.package", module: "android", title: "Package match", status: "pass", message: "com.example.app is listed." },
    { id: "al.fp:AA", module: "android", title: "Signing fingerprint", status: "fail",
      message: "Fingerprint is not listed for this package.",
      evidence: "Provided: 14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5\nListed: 5A:1B:...:9C (upload key only)",
      fix: "If you use Play App Signing, add the app signing key SHA-256 from Play Console > App integrity (not just your upload key)." },
  ],
};
