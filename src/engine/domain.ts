import dns from "node:dns/promises";
import tls from "node:tls";
import { isPrivateIp, errMsg } from "./net";
import type { CheckResult, DiagnoseInput, Options } from "./types";

export async function checkDomain(input: DiagnoseInput, opts: Options): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  const [host, port] = input.domain.split(":");
  const base = { module: "domain" as const };

  let addrs: string[] = [];
  try {
    const r = await dns.lookup(host, { all: true });
    addrs = r.map((a) => a.address);
    if (!opts.allowPrivate && addrs.some(isPrivateIp)) {
      out.push({ ...base, id: "dns.private", title: "DNS resolution", status: "fail",
        message: "Domain resolves to a private or reserved address.", evidence: addrs.join(", "),
        fix: "Apple and Google must reach this host from the public internet. Point DNS at a public address." });
      return out;
    }
    out.push({ ...base, id: "dns.resolve", title: "DNS resolution", status: "pass",
      message: `Resolves to ${addrs.length} address(es).`, evidence: addrs.join(", ") });
  } catch (e) {
    out.push({ ...base, id: "dns.resolve", title: "DNS resolution", status: "fail",
      message: "Domain does not resolve.", evidence: errMsg(e),
      fix: "Check the domain spelling and that an A/AAAA/CNAME record exists." });
    return out;
  }

  try {
    const cert = await new Promise<tls.PeerCertificate & { authError?: string }>((resolve, reject) => {
      const s = tls.connect({ host, port: Number(port) || 443, servername: host, timeout: opts.timeoutMs ?? 8000,
        rejectUnauthorized: false }, () => {
        const c = s.getPeerCertificate();
        const authError = s.authorizationError ? String(s.authorizationError) : undefined;
        s.end();
        resolve({ ...c, authError });
      });
      s.on("timeout", () => s.destroy(new Error("TLS connection timed out")));
      s.on("error", reject);
    });
    if (cert.authError) {
      out.push({ ...base, id: "tls.valid", title: "SSL certificate", status: "fail",
        message: "Certificate is not trusted.", evidence: cert.authError,
        fix: "Apple and Google reject self-signed, expired or mismatched certificates. Install a valid certificate from a public CA (e.g. Let's Encrypt) covering this hostname." });
    } else {
      const days = Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86_400_000);
      out.push({ ...base, id: "tls.valid", title: "SSL certificate", status: days < 14 ? "warn" : "pass",
        message: days < 14 ? `Certificate expires in ${days} day(s).` : `Valid certificate, expires in ${days} days.`,
        evidence: `Issuer: ${(cert.issuer as any)?.O ?? "unknown"}; expires ${cert.valid_to}`,
        fix: days < 14 ? "Renew the certificate and enable auto-renewal." : undefined });
    }
  } catch (e) {
    out.push({ ...base, id: "tls.valid", title: "SSL certificate", status: "fail",
      message: "Could not establish an HTTPS connection.", evidence: errMsg(e),
      fix: "Ensure the server listens on port 443 with TLS enabled and is reachable from the internet." });
  }
  return out;
}
