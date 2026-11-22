import { describe, it, expect } from "vitest";
import { isPrivateIp } from "../src/engine/net";

describe("SSRF guard", () => {
  it("flags private ranges", () => {
    for (const ip of ["127.0.0.1", "10.0.0.1", "192.168.1.1", "172.16.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:127.0.0.1"])
      expect(isPrivateIp(ip)).toBe(true);
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700::1111"]) expect(isPrivateIp(ip)).toBe(false);
  });
});
