import { z } from "zod";
import { parseCampaignEntry, type CampaignTarget } from "./campaign";

export type { CampaignTarget };

export type Status = "pass" | "fail" | "warn" | "info";
export type Module = "domain" | "ios" | "android" | "redirects";

export interface CheckResult {
  id: string;
  module: Module;
  title: string;
  status: Status;
  message: string;
  evidence?: string;
  fix?: string;
}

export interface Report {
  domain: string;
  generatedAt: string;
  summary: Record<Status, number>;
  results: CheckResult[];
}

const hostname = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
  .refine((v) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d{1,5})?$/.test(v), {
    message: "Enter a valid domain such as example.com",
  });

export const InputSchema = z.object({
  domain: hostname,
  /** iOS app ID: "<TEAMID>.<bundle.id>" */
  iosAppId: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{10}\.[A-Za-z0-9.-]+$/, "Expected format TEAMID.com.example.app")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  androidPackage: z
    .string()
    .trim()
    .regex(/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/, "Expected format com.example.app")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /** SHA-256 signing cert fingerprints */
  androidFingerprints: z.array(z.string().trim()).max(5, "At most 5 fingerprints").default([]),
  /** Campaign URLs (https://…) or paths (/offer/…) to test against AASA rules */
  paths: z.array(z.string().trim().max(500)).max(10, "At most 10 campaign URLs or paths").default([]),
})
  .superRefine((data, ctx) => {
    for (let i = 0; i < data.paths.length; i++) {
      try {
        parseCampaignEntry(data.paths[i]!, data.domain);
      } catch (e) {
        ctx.addIssue({
          code: "custom",
          path: ["paths", i],
          message: e instanceof Error ? e.message : "Invalid campaign URL or path",
        });
      }
    }
  })
  .transform((data) => {
    const campaigns = data.paths.map((p) => parseCampaignEntry(p, data.domain));
    return {
      ...data,
      campaigns,
      paths: campaigns.map((c) => c.path),
    };
  });

export type DiagnoseInput = z.output<typeof InputSchema>;
export type DiagnoseInputRaw = z.input<typeof InputSchema>;

export interface Options {
  /** Allow private/loopback targets (CLI/local use only). Never enable on the hosted app. */
  allowPrivate?: boolean;
  timeoutMs?: number;
}
