import { InputSchema, type CheckResult, type DiagnoseInputRaw, type Options, type Report, type Status } from "./types";
import { checkDomain } from "./domain";
import { checkIos } from "./ios";
import { checkAndroid } from "./android";
import { checkRedirects } from "./redirects";

export * from "./types";
export { analyzeAasa, evaluatePath } from "./ios";
export { analyzeAssetLinks } from "./android";
export { normalizeFingerprint, globMatch } from "./match";
export { parseCampaignEntry, campaignHostsMatch } from "./campaign";

export function summarize(results: CheckResult[]): Record<Status, number> {
  const s: Record<Status, number> = { pass: 0, fail: 0, warn: 0, info: 0 };
  for (const r of results) s[r.status]++;
  return s;
}

/** Orchestrator: runs all modules concurrently and builds the report. */
export async function diagnose(raw: DiagnoseInputRaw, opts: Options = {}): Promise<Report> {
  const input = InputSchema.parse(raw);
  const settle = async (module: CheckResult["module"], p: Promise<CheckResult[]>): Promise<CheckResult[]> => {
    try { return await p; } catch (e) {
      return [{ id: `${module}.crash`, module, title: "Internal error", status: "info",
        message: e instanceof Error ? e.message : String(e) }];
    }
  };
  const groups = await Promise.all([
    settle("domain", checkDomain(input, opts)),
    settle("redirects", checkRedirects(input, opts)),
    settle("ios", checkIos(input, opts)),
    settle("android", checkAndroid(input, opts)),
  ]);
  const results = groups.flat();
  return { domain: input.domain, generatedAt: new Date().toISOString(), summary: summarize(results), results };
}
