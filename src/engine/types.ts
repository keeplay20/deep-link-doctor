import { z } from "zod";

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
  /** Paths that should open the app, e.g. /product/123 */
  paths: z.array(z.string().trim().max(200).startsWith("/", "Paths must start with /")).max(10, "At most 10 paths").default([]),
});

export type DiagnoseInput = z.infer<typeof InputSchema>;
export type DiagnoseInputRaw = z.input<typeof InputSchema>;

export interface Options {
  /** Allow private/loopback targets (CLI/local use only). Never enable on the hosted app. */
  allowPrivate?: boolean;
  timeoutMs?: number;
}
