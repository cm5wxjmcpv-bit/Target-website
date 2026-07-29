import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const context = vm.createContext({
  console,
  Date,
  isFinite,
});
vm.runInContext(
  readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8"),
  context,
);

test("Apps Script accepts only real reporting months", () => {
  assert.equal(context.strictPeriodKey_("2026-01"), "2026-01");
  assert.equal(context.strictPeriodKey_("2026-12"), "2026-12");
  assert.equal(context.strictPeriodKey_("2026-00"), "");
  assert.equal(context.strictPeriodKey_("2026-13"), "");
});

test("Apps Script rejects impossible completion dates", () => {
  assert.equal(context.completionDatePeriodKey_("13/40/2026"), "");
  assert.equal(context.completionDatePeriodKey_("02/29/2025"), "");
  assert.equal(context.completionDatePeriodKey_("02/29/2024"), "2024-02");
});

test("documented hours preserve fractional values", () => {
  assert.equal(context.documentedHours_({ "Duration (hours)": "0.25" }), 0.25);
  assert.equal(context.documentedHours_({ "Time Spent In Course": "1:30:00" }), 1.5);
  assert.equal(context.documentedHours_({ "Time Spent In Course": "0:15" }), 0.25);
});

test("between-dates filters accept inclusive real calendar dates", () => {
  assert.equal(context.strictIsoDate_("2026-02-28"), "2026-02-28");
  assert.equal(context.strictIsoDate_("2026-02-30"), "");
  assert.equal(context.completionDateIsoKey_("01/15/2026"), "2026-01-15");
  const range = context.strictDateRange_("2026-01-01", "2026-05-31");
  assert.equal(range.startDate, "2026-01-01");
  assert.equal(range.endDate, "2026-05-31");
  assert.throws(() => context.strictDateRange_("2026-06-01", "2026-05-31"));
});
