import { describe, it, expect } from "vitest";
import {
  analyzeAasa,
  analyzeAssetLinks,
  evaluatePath,
  normalizeFingerprint,
  InputSchema,
  parseCampaignEntry,
} from "../src/engine";

const FP = "14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5";
const mk = (o: object) => InputSchema.parse({ domain: "example.com", ...o });
const status = (rs: { id: string; status: string }[], id: string) => rs.find((r) => r.id === id)?.status;

describe("fingerprints", () => {
  it("normalizes formats", () => {
    expect(normalizeFingerprint(FP.replace(/:/g, "").toLowerCase())).toBe(FP);
    expect(normalizeFingerprint("abc")).toBeNull();
  });
});

describe("AASA", () => {
  const aasa = JSON.stringify({ applinks: { details: [{ appIDs: ["ABCDE12345.com.example.app"],
    components: [{ "/": "/admin/*", exclude: true }, { "/": "/product/*" }] }] } });
  it("passes on match", () => {
    const r = analyzeAasa(aasa, mk({ iosAppId: "ABCDE12345.com.example.app", paths: ["/product/1"] }));
    expect(status(r, "aasa.appid")).toBe("pass");
    expect(status(r, "aasa.path:/product/1")).toBe("pass");
  });
  it("flags wrong team id", () => {
    const r = analyzeAasa(aasa, mk({ iosAppId: "ZZZZZ12345.com.example.app" }));
    expect(r.find((x) => x.id === "aasa.appid")).toMatchObject({ status: "fail", message: expect.stringContaining("Team ID") });
  });
  it("respects exclusions and missing rules", () => {
    const r = analyzeAasa(aasa, mk({ iosAppId: "ABCDE12345.com.example.app", paths: ["/admin/x", "/other"] }));
    expect(status(r, "aasa.path:/admin/x")).toBe("fail");
    expect(status(r, "aasa.path:/other")).toBe("fail");
  });
  it("supports legacy paths with NOT", () => {
    const d = { paths: ["NOT /a/*", "/*"] };
    expect(evaluatePath(d, "/a/b").matched).toBe(false);
    expect(evaluatePath(d, "/c").matched).toBe(true);
  });
  it("rejects invalid JSON", () => {
    expect(analyzeAasa("<html>", mk({}))[0].status).toBe("fail");
  });
});

describe("assetlinks", () => {
  const al = JSON.stringify([{ relation: ["delegate_permission/common.handle_all_urls"],
    target: { namespace: "android_app", package_name: "com.example.app", sha256_cert_fingerprints: [FP] } }]);
  it("passes on package + fingerprint", () => {
    const r = analyzeAssetLinks(al, mk({ androidPackage: "com.example.app", androidFingerprints: [FP.replace(/:/g, "").toLowerCase()] }));
    expect(r.filter((x) => x.status === "fail")).toEqual([]);
  });
  it("fails on fingerprint mismatch", () => {
    const other = FP.replace("14", "15");
    const r = analyzeAssetLinks(al, mk({ androidPackage: "com.example.app", androidFingerprints: [other] }));
    expect(r.some((x) => x.id.startsWith("al.fp") && x.status === "fail")).toBe(true);
  });
  it("fails on wrong package", () => {
    expect(status(analyzeAssetLinks(al, mk({ androidPackage: "com.other" })), "al.package")).toBe("fail");
  });
});

describe("input", () => {
  it("normalizes domain from URL", () => {
    expect(mk({ domain: "https://Example.com/path" }).domain).toBe("example.com");
  });
  it("rejects bad domain", () => {
    expect(() => InputSchema.parse({ domain: "localhost" })).toThrow();
  });
  it("parses full campaign URLs into paths with query", () => {
    const v = mk({
      paths: ["https://example.com/offer/sale?utm=campaign&ref=1", "/plain"],
    });
    expect(v.campaigns).toHaveLength(2);
    expect(v.campaigns[0]!.path).toBe("/offer/sale?utm=campaign&ref=1");
    expect(v.campaigns[0]!.urlHost).toBe("example.com");
    expect(v.campaigns[1]!.path).toBe("/plain");
  });
  it("rejects non-path lines without a scheme", () => {
    expect(() => InputSchema.parse({ domain: "example.com", paths: ["offer/sale"] })).toThrow();
  });
});

describe("campaign URLs", () => {
  const aasa = JSON.stringify({
    applinks: {
      details: [
        {
          appIDs: ["ABCDE12345.com.example.app"],
          components: [{ "/": "/offer/*", "?": { utm_campaign: "*" } }],
        },
      ],
    },
  });

  it("matches query params from a pasted URL", () => {
    const input = mk({
      iosAppId: "ABCDE12345.com.example.app",
      paths: ["https://example.com/offer/summer?utm_campaign=bf"],
    });
    const r = analyzeAasa(aasa, input);
    expect(status(r, "aasa.path:/offer/summer?utm_campaign=bf")).toBe("pass");
  });

  it("warns when campaign host differs from diagnosed domain", () => {
    const input = mk({
      iosAppId: "ABCDE12345.com.example.app",
      paths: ["https://www.example.com/offer/summer"],
    });
    const r = analyzeAasa(aasa, input);
    expect(r.some((x) => x.id.startsWith("campaign.host") && x.status === "warn")).toBe(true);
  });

  it("parseCampaignEntry strips hash", () => {
    expect(parseCampaignEntry("https://example.com/a#frag", "example.com").path).toBe("/a");
  });
});
