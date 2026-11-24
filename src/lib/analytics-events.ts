import type { DiagnoseInput, Report } from "@/engine/types";

/** Props sent to PostHog — no fingerprints, App IDs, packages, or campaign URLs. */
export function diagnoseProps(input: DiagnoseInput, report?: Report) {
  return {
    domain: input.domain,
    has_ios_app_id: Boolean(input.iosAppId),
    has_android_package: Boolean(input.androidPackage),
    fingerprint_count: input.androidFingerprints.length,
    campaign_count: input.campaigns.length,
    ...(report && {
      fail_count: report.summary.fail,
      warn_count: report.summary.warn,
      pass_count: report.summary.pass,
    }),
  };
}