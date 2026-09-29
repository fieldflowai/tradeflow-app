import test from "node:test";
import assert from "node:assert/strict";
import { getTrustedAppOrigin, safeInternalRedirect } from "../lib/security.mjs";

test("safeInternalRedirect accepts only internal paths", () => {
  assert.equal(safeInternalRedirect("/dashboard?tab=jobs"), "/dashboard?tab=jobs");
  assert.equal(safeInternalRedirect("https://attacker.example"), "/dashboard");
  assert.equal(safeInternalRedirect("//attacker.example/path"), "/dashboard");
  assert.equal(safeInternalRedirect("\\\\attacker.example"), "/dashboard");
  assert.equal(safeInternalRedirect(""), "/dashboard");
});

test("getTrustedAppOrigin permits HTTPS and local development origins only", () => {
  assert.equal(getTrustedAppOrigin("https://tradeflow.example"), "https://tradeflow.example");
  assert.equal(getTrustedAppOrigin("http://localhost:3000"), "http://localhost:3000");
  assert.equal(getTrustedAppOrigin("http://tradeflow.example"), null);
  assert.equal(getTrustedAppOrigin("https://tradeflow.example/path"), null);
  assert.equal(getTrustedAppOrigin("https://user:pass@tradeflow.example"), null);
});
