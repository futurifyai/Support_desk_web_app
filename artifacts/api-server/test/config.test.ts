import { afterEach, describe, expect, it } from "vitest";
import { getSessionSecret, getTrustedProxyHops } from "../src/config";

const originalSecret = process.env["SESSION_SECRET"];
const originalEnvironment = process.env["NODE_ENV"];
const originalProxyHops = process.env["TRUST_PROXY_HOPS"];

afterEach(() => {
  if (originalSecret === undefined) delete process.env["SESSION_SECRET"];
  else process.env["SESSION_SECRET"] = originalSecret;
  if (originalEnvironment === undefined) delete process.env["NODE_ENV"];
  else process.env["NODE_ENV"] = originalEnvironment;
  if (originalProxyHops === undefined) delete process.env["TRUST_PROXY_HOPS"];
  else process.env["TRUST_PROXY_HOPS"] = originalProxyHops;
});

describe("getSessionSecret", () => {
  it("rejects a missing secret", () => {
    delete process.env["SESSION_SECRET"];
    expect(() => getSessionSecret()).toThrow("SESSION_SECRET must be configured");
  });

  it("rejects a short secret", () => {
    process.env["SESSION_SECRET"] = "too-short";
    expect(() => getSessionSecret()).toThrow("at least 32 characters");
  });

  it("trims and returns a sufficiently long secret", () => {
    process.env["SESSION_SECRET"] = "  this-is-a-long-enough-session-secret  ";
    expect(getSessionSecret()).toBe("this-is-a-long-enough-session-secret");
  });

  it("requires an explicit proxy-hop policy in production", () => {
    process.env["NODE_ENV"] = "production";
    delete process.env["TRUST_PROXY_HOPS"];
    expect(() => getTrustedProxyHops()).toThrow("TRUST_PROXY_HOPS must be configured");

    process.env["TRUST_PROXY_HOPS"] = "1";
    expect(getTrustedProxyHops()).toBe(1);
  });
});