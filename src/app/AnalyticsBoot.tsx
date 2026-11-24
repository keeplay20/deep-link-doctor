"use client";

import { useEffect } from "react";
import { captureClient } from "@/lib/analytics-client";

/** One pageview per load; key never exposed to the browser. */
export default function AnalyticsBoot() {
  useEffect(() => {
    captureClient("pageview", { path: window.location.pathname });
  }, []);
  return null;
}