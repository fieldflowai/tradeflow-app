import test from "node:test";
import assert from "node:assert/strict";
import { parsePriceBookCsv } from "../lib/priceBookCsv.mjs";
import { applyPriceBookRates } from "../lib/priceBookPricing.mjs";

test("CSV import supports quoted fields, header aliases, and currency values", () => {
  const rows = parsePriceBookCsv('Item,Description,Trade,UOM,Price\n"Faucet install","Kitchen, standard",Plumbing,each,"$245.50"');
  assert.deepEqual(rows, [{ name: "Faucet install", description: "Kitchen, standard", trade: "Plumbing", unit: "each", unit_price: 245.5 }]);
});

test("CSV import rejects missing prices and malformed quoting", () => {
  assert.throws(() => parsePriceBookCsv("Name,Price\nFaucet,abc"), /Row 2/);
  assert.throws(() => parsePriceBookCsv('Name,Price\n"Faucet,25'), /unclosed quotation/);
});

test("contractor price book rates only override clear trade and unit matches", () => {
  const result = applyPriceBookRates(
    [{ description: "Faucet replacement / installation", quantity: 2, unit_price: 225 }],
    [{ name: "Faucet installation", trade: "Plumbing", unit: "each", unit_price: 310 }],
    "Plumbing",
  );
  assert.equal(result.lines[0].unit_price, 310);
  assert.equal(result.matchedCount, 1);
});

test("hourly and measurement-based rates require the same units", () => {
  const result = applyPriceBookRates(
    [{ description: "Wiring work (hour)", quantity: 4, unit_price: 0 }],
    [{ name: "Wiring work", trade: "Electrical", unit: "hours", unit_price: 125 }],
    "Electrical",
    true,
  );
  assert.equal(result.lines[0].unit_price, 125);
});

test("do not apply ambiguous or incompatible Price Book rates", () => {
  const lines = [{ description: "Faucet replacement / installation", quantity: 1, unit_price: 225 }];
  const result = applyPriceBookRates(lines, [
    { name: "Faucet installation", trade: "Plumbing", unit: "hour", unit_price: 310 },
    { name: "Faucet replacement", trade: "Plumbing", unit: "each", unit_price: 320 },
    { name: "Faucet service", trade: "Plumbing", unit: "each", unit_price: 330 },
  ], "Plumbing");
  assert.equal(result.lines[0].unit_price, 225);
  assert.equal(result.matchedCount, 0);
});
