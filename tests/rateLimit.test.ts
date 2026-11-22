import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, _resetForTests } from "../src/app/api/diagnose/rateLimit";

describe("rateLimit", () => {
  beforeEach(_resetForTests);
  it("blocks after the limit and resets after the window", () => {
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 1000, 0).ok).toBe(true);
    const r = rateLimit("k", 3, 1000, 10);
    expect(r.ok).toBe(false);
    expect(r.retryAfter).toBe(1);
    expect(rateLimit("k", 3, 1000, 1001).ok).toBe(true);
  });
  it("tracks keys independently", () => {
    rateLimit("a", 1, 1000, 0);
    expect(rateLimit("a", 1, 1000, 1).ok).toBe(false);
    expect(rateLimit("b", 1, 1000, 1).ok).toBe(true);
  });
});
