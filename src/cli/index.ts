import { diagnose } from "../engine";

const args = process.argv.slice(2);
const get = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const all = (k: string) => args.flatMap((a, i) => (a === `--${k}` ? [args[i + 1]] : []));

const domain = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1]?.startsWith("--") !== true);
if (!domain) {
  console.error("Usage: deeplink-doctor <domain> [--ios TEAMID.bundle] [--package com.app] [--sha256 FP]... [--path /p]... [--json]");
  process.exit(2);
}
const icon = { pass: "✔", fail: "✖", warn: "!", info: "i" } as const;
diagnose({ domain, iosAppId: get("ios"), androidPackage: get("package"), androidFingerprints: all("sha256"), paths: all("path") },
  { allowPrivate: args.includes("--allow-private") })
  .then((r) => {
    if (args.includes("--json")) console.log(JSON.stringify(r, null, 2));
    else {
      for (const c of r.results) {
        console.log(`${icon[c.status]} [${c.module}] ${c.title}: ${c.message}`);
        if (c.evidence) console.log("    " + c.evidence.split("\n").join("\n    "));
        if (c.fix && c.status !== "pass") console.log("    Fix: " + c.fix);
      }
      console.log(`\n${r.summary.pass} passed, ${r.summary.fail} failed, ${r.summary.warn} warnings`);
    }
    process.exit(r.summary.fail ? 1 : 0);
  })
  .catch((e) => { console.error(e.message ?? e); process.exit(2); });
