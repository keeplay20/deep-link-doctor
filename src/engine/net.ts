import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import net from "node:net";

export interface HttpResponse {
  url: string;
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
  truncated: boolean;
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const l = ip.toLowerCase();
  if (l.startsWith("::ffff:")) return isPrivateIp(l.slice(7));
  return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80");
}

/** Single request, no redirect following. Blocks private IPs (SSRF) unless allowed. */
export function httpGet(
  url: string,
  opts: { allowPrivate?: boolean; timeoutMs?: number; maxBytes?: number } = {},
): Promise<HttpResponse> {
  const { allowPrivate = false, timeoutMs = 8000, maxBytes = 256 * 1024 } = opts;
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === "https:" ? https : http;
    const lookup: net.LookupFunction = (host, options, cb) => {
      dns.lookup(host, { ...options, all: true }, (err, addrs) => {
        if (err) return (cb as any)(err);
        const list = addrs as dns.LookupAddress[];
        if (!allowPrivate && list.some((a) => isPrivateIp(a.address))) {
          return (cb as any)(new Error(`Blocked: ${host} resolves to a private address`));
        }
        if ((options as any).all) return (cb as any)(null, list);
        (cb as any)(null, list[0].address, list[0].family);
      });
    };
    const req = mod.request(
      u,
      { method: "GET", lookup, timeout: timeoutMs, headers: { "user-agent": "DeepLinkDoctor/0.1", accept: "*/*" } },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > maxBytes) { truncated = true; res.destroy(); return; }
          chunks.push(c);
        });
        const done = () =>
          resolve({
            url, status: res.statusCode ?? 0, headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"), truncated,
          });
        res.on("end", done);
        res.on("close", done);
      },
    );
    req.on("timeout", () => req.destroy(new Error(`Timed out after ${timeoutMs}ms`)));
    req.on("error", reject);
    req.end();
  });
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
