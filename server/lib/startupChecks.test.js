import { describe, expect, it } from "vitest";
import { getStartupWarnings } from "./startupChecks.js";

const LOCAL = ["http://localhost:5173"];
const SITE = ["https://my-app.vercel.app"];

describe("startup warnings", () => {
  it("says nothing for a sensible local setup", () => {
    expect(getStartupWarnings({ env: {}, trustProxy: false, origins: LOCAL })).toEqual([]);
  });

  it("says nothing for a correct hosted setup", () => {
    expect(getStartupWarnings({ env: { RENDER: "true" }, trustProxy: true, origins: SITE })).toEqual([]);
  });

  it("warns when hosted without TRUST_PROXY", () => {
    const [warning] = getStartupWarnings({ env: { RENDER: "true" }, trustProxy: false, origins: SITE });
    expect(warning).toContain("TRUST_PROXY");
    expect(getStartupWarnings({ env: { NODE_ENV: "production" }, trustProxy: false, origins: SITE })).toHaveLength(1);
  });

  it("warns about a wildcard origin", () => {
    const [warning] = getStartupWarnings({ env: {}, trustProxy: false, origins: ["*"] });
    expect(warning).toContain("*");
  });

  it("warns when a hosted server only allows localhost", () => {
    const warnings = getStartupWarnings({ env: { RENDER: "true" }, trustProxy: true, origins: LOCAL });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("localhost");
  });
});
