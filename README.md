# Deep Link Doctor

Open-source diagnostics for iOS Universal Links and Android App Links. Explains *why* links fail and how to fix them.

## Run
```bash
npm install
npm run dev                      # web app at http://localhost:3000
npm run cli -- example.com --ios TEAMID.com.example.app \
  --package com.example.app --sha256 AA:BB:... --path /product/1
npm test
```
Deploy to Vercel by importing the repo. No env vars or database required.

## Architecture
`src/engine` is framework-independent (no Next.js imports) and is used by the web API (`src/app/api/diagnose`) and the CLI (`src/cli`).
Modules: domain (DNS/TLS), redirects, ios (AASA), android (assetlinks). Each returns `CheckResult { status, message, evidence, fix }`.

## Security
The hosted API blocks requests to private/loopback addresses (SSRF), at connection time. `--allow-private` is CLI-only.
Add rate limiting (e.g. Vercel Firewall) before public launch.

## Roadmap
Phase 2: Expo config / entitlements / manifest / route analysis. Phase 3: GitHub scanning, Action. Phase 4: emulator tests.

MIT licensed.
