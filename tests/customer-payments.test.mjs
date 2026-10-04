import test from "node:test";
import assert from "node:assert/strict";
import { estimateTotalCents, paidCents } from "../lib/customer-payment-calculations.mjs";

test("calculates estimate total from line items, markup, and tax in cents", () => {
  assert.equal(estimateTotalCents({ markup_percentage: 10, tax_rate: 5 }, [
    { quantity: 2, unit_price: 100.25 },
  ]), 23158);
});

test("uses the selected package total without applying markup a second time", () => {
  assert.equal(estimateTotalCents({
    package_options: [{ name: "Standard", total: 250 }],
    selected_package: "Standard",
    markup_percentage: 25,
    tax_rate: 8,
  }, [{ quantity: 1, unit_price: 400 }]), 27000);
});

test("rejects non-finite, zero, or negative totals", () => {
  assert.equal(estimateTotalCents({ tax_rate: 0 }, [{ quantity: 1, unit_price: Number.NaN }]), 0);
  assert.equal(estimateTotalCents({ tax_rate: 0 }, [{ quantity: 1, unit_price: -2 }]), 0);
});

test("paid amount excludes open and failed checkouts and subtracts refunds", () => {
  assert.equal(paidCents([
    { status: "pending", amount_cents: 5000, amount_refunded_cents: 0 },
    { status: "failed", amount_cents: 3000, amount_refunded_cents: 0 },
    { status: "succeeded", amount_cents: 10000, amount_refunded_cents: 0 },
    { status: "partially_refunded", amount_cents: 4000, amount_refunded_cents: 1500 },
    { status: "refunded", amount_cents: 2000, amount_refunded_cents: 2000 },
  ]), 12500);
});
