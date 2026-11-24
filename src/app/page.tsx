"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import NetworkBackground from "./NetworkBackground";
import { sampleReport } from "./sampleReport";
import type { Report, CheckResult, Status } from "@/engine/types";
import { captureClient } from "@/lib/analytics-client";

const badge: Record<Status, string> = {
  pass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
  fail: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  info: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};
const accent: Record<Status, string> = {
  pass: "border-t-emerald-400",
  fail: "border-t-rose-500",
  warn: "border-t-amber-400",
  info: "border-t-slate-300 dark:border-t-slate-600",
};
const icon: Record<Status, string> = { pass: "✓", fail: "✕", warn: "!", info: "i" };
const order: Record<Status, number> = { fail: 0, warn: 1, info: 2, pass: 3 };
const titles = { domain: "Domain health", redirects: "Redirects", ios: "iOS (Universal Links)", android: "Android (App Links)" } as const;
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

const list: Variants = { show: { transition: { staggerChildren: 0.06 } } };
const rise: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [dark, setDark] = useState(true);
  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  }

  function showSample() {
    setError(null);
    setIsSample(true);
    setReport(sampleReport);
    captureClient("sample_report_viewed");
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true); setError(null); setReport(null); setIsSample(false);
    const paths = lines(String(f.get("paths") ?? ""));
    captureClient("diagnose_submitted", {
      has_ios_app_id: Boolean(String(f.get("iosAppId") ?? "").trim()),
      has_android_package: Boolean(String(f.get("androidPackage") ?? "").trim()),
      fingerprint_count: lines(String(f.get("fp") ?? "")).length,
      campaign_count: paths.length,
    });
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          domain: f.get("domain"),
          iosAppId: f.get("iosAppId"),
          androidPackage: f.get("androidPackage"),
          androidFingerprints: lines(String(f.get("fp") ?? "")),
          paths,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.issues?.map((i: any) => i.message).join("; ") ?? data.error);
      setReport(data);
    } catch (err) {
      captureClient("diagnose_client_error", { message: err instanceof Error ? err.message.slice(0, 120) : "unknown" });
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(false); }
  }

  const input =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:placeholder:text-slate-500 dark:focus:ring-indigo-500/20";
  const hint = "mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400";

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <NetworkBackground />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-200/50 blur-3xl dark:bg-indigo-600/20"
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-40 -right-24 h-72 w-72 rounded-full bg-fuchsia-200/40 blur-3xl dark:bg-fuchsia-600/20"
        animate={{ x: [0, -40, 0], y: [0, 40, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />

      <button
        type="button"
        onClick={toggleTheme}
        aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
        className="absolute right-4 top-4 z-10 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-sm shadow-sm backdrop-blur transition hover:scale-105 dark:border-slate-700 dark:bg-slate-800/80"
      >
        {dark ? "☀️ Light" : "🌙 Dark"}
      </button>

      <main className="relative mx-auto max-w-6xl px-4 py-12">
        <motion.header initial="hidden" animate="show" variants={list}>
          <motion.h1 variants={rise} className="text-4xl font-extrabold tracking-tight">
            Deep Link <span className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text dark:from-indigo-400 dark:to-fuchsia-400 text-transparent">Doctor</span>
          </motion.h1>
          <motion.p variants={rise} className="mt-2 text-slate-600 dark:text-slate-400">
            Links open your website instead of your app? Enter your domain and we&apos;ll show exactly what is broken and how to fix it.
          </motion.p>
          <motion.ul variants={rise} className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
            {["Checks apple-app-site-association", "Checks assetlinks.json", "Detects bad redirects"].map((t) => (
              <li key={t} className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 dark:border-slate-700 dark:bg-slate-800/60">{t}</li>
            ))}
          </motion.ul>
        </motion.header>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[26rem_minmax(0,1fr)]">
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 200, damping: 22 }}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-lg shadow-indigo-100/50 backdrop-blur lg:sticky lg:top-6 dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-black/30"
        >
          <label className="block text-sm font-medium">
            Domain
            <input name="domain" required placeholder="example.com" className={input} />
            <span className={hint}>The website that hosts your link files. No path needed, e.g. example.com or https://example.com</span>
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              iOS App ID <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
              <input name="iosAppId" placeholder="ABCDE12345.com.example.app" className={input} />
              <span className={hint}>Apple Team ID (10 characters) + dot + bundle ID</span>
            </label>
            <label className="block text-sm font-medium">
              Android package <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
              <input name="androidPackage" placeholder="com.example.app" className={input} />
              <span className={hint}>The applicationId from your app&apos;s build.gradle</span>
            </label>
          </div>

          <label className="block text-sm font-medium">
            Android SHA-256 fingerprints <span className="font-normal text-slate-400">(one per line, optional)</span>
            <textarea
              name="fp"
              rows={3}
              placeholder={"14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5"}
              className={input + " font-mono text-xs"}
            />
            <span className={hint}>Run <code>keytool -list -v -keystore my-release.keystore</code> and copy the SHA256 line</span>
          </label>

          <label className="block text-sm font-medium">
            Campaign URLs or paths <span className="font-normal text-slate-400">(one per line, optional)</span>
            <textarea
              name="paths"
              rows={3}
              placeholder={"https://example.com/offer/summer?utm=email\n/product/123"}
              className={input + " font-mono text-xs"}
            />
            <span className={hint}>Paste the full link from your ad or email, or a path like /app/offer. We check whether AASA includes or excludes it (iOS App ID required).</span>
          </label>

          <motion.button
            whileHover={{ scale: loading ? 1 : 1.03 }}
            whileTap={{ scale: loading ? 1 : 0.97 }}
            disabled={loading}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-300/50 disabled:opacity-60"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <motion.span
                  className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                />
                Running checks…
              </span>
            ) : "Run diagnostics"}
          </motion.button>
          <button
            type="button"
            onClick={showSample}
            className="ml-3 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            See sample report
          </button>
        </motion.form>

        <div className="min-w-0">
        <AnimatePresence>
          {error && (
            <motion.p
              role="alert"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
        {report && isSample && (
          <p className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
            Sample report with made-up data for demonstration. Not a live scan.
          </p>
        )}
        {report && <ReportView report={report} />}
        {!report && !error && !loading && (
          <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Your results will appear here. Problems are shown first, with the exact fix for each.
          </div>
        )}
        {loading && (
          <div className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-200 p-8 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Checking your domain…
          </div>
        )}
        </div>
        </div>
        <p className="mt-10 text-center text-xs text-slate-500 dark:text-slate-500">
          Optional usage analytics (hostname and result counts) via PostHog when configured. No fingerprints or app secrets are sent.
        </p>
      </main>
    </div>
  );
}

function ReportView({ report }: { report: Report }) {
  const { fail, warn, pass } = report.summary;
  const groups = (Object.keys(titles) as (keyof typeof titles)[]).map(
    (m) => [m, report.results.filter((r) => r.module === m).sort((a, b) => order[a.status] - order[b.status])] as const,
  );
  const healthy = fail === 0 && warn === 0;

  return (
    <motion.section initial="hidden" animate="show" variants={list}>
      <motion.div
        variants={rise}
        className={`rounded-2xl border p-5 ${healthy ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10" : fail ? "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10" : "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"}`}
      >
        <h2 className="text-xl font-bold">
          {healthy ? "All good! " : fail ? `${fail} problem${fail > 1 ? "s" : ""} found. ` : "Almost there. "}
          <span className="font-medium text-slate-600 dark:text-slate-400">{report.domain}</span>
        </h2>
        <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
          {healthy
            ? "Your deep link setup looks healthy."
            : "Problems are listed first. Each one explains what is wrong and how to fix it."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm font-medium">
          <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">{fail} failed</span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">{warn} warnings</span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">{pass} passed</span>
        </div>
      </motion.div>

      {groups.map(([m, items]) => items.length > 0 && (
        <div key={m} className="mt-8">
          <motion.h3 variants={rise} className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{titles[m]}</motion.h3>
          <motion.ul variants={list} className="grid items-stretch gap-4 md:grid-cols-2">
            {items.map((r) => <Item key={r.id} r={r} />)}
          </motion.ul>
        </div>
      ))}
    </motion.section>
  );
}

function Item({ r }: { r: CheckResult }) {
  const bad = r.status === "fail" || r.status === "warn";
  return (
    <motion.li
      variants={rise}
      whileHover={{ y: -2 }}
      className={`flex min-w-0 flex-col rounded-2xl border border-t-4 border-slate-200 bg-white p-4 shadow-md dark:border-slate-800 dark:bg-slate-900 ${accent[r.status]}`}
    >
      <div className="flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${badge[r.status]}`}>{icon[r.status]}</span>
        <span className="font-semibold">{r.title}</span>
        <span className={`ml-auto rounded px-2 py-0.5 text-xs font-semibold uppercase ${badge[r.status]}`}>{r.status}</span>
      </div>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
        {bad && <b className="text-slate-900 dark:text-white">What&apos;s wrong: </b>}
        {r.message}
      </p>
      {r.evidence && <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-100 p-2 text-xs dark:bg-slate-950 dark:text-slate-300">{r.evidence}</pre>}
      {r.fix && r.status !== "pass" && (
        <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900 dark:bg-indigo-500/10 dark:text-indigo-200"><b>How to fix: </b>{r.fix}</p>
      )}
    </motion.li>
  );
}
