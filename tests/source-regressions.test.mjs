import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const configSource = readFileSync(new URL("../app/config.ts", import.meta.url), "utf8");
const appsScriptSource = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");

test("production source no longer contains public demo mode", () => {
  assert.doesNotMatch(pageSource, /\bdemoMode\b|\bDEMO_DATA\b|\bDEMO_CATEGORIES\b/);
  assert.doesNotMatch(pageSource, /Preview login|demo\s*\/\s*demo/i);
});

test("mobile styles keep the user menu and sign-out control available", () => {
  assert.doesNotMatch(
    cssSource,
    /\.brand-lockup\s*>\s*div:last-child\s+span\s*,\s*\.user-menu\s*>\s*div\s*\{\s*display:\s*none/i,
  );
  assert.match(cssSource, /\.user-menu\s+strong\s*\{\s*display:\s*none/i);
});

test("uploads use protected batch imports and prevent browser file navigation", () => {
  assert.match(pageSource, /action:\s*"importReportBatch"/);
  assert.match(pageSource, /window\.addEventListener\("drop",\s*preventBrowserFileOpen\)/);
  assert.match(appsScriptSource, /version:\s*"1\.3\.0"/);
  assert.match(appsScriptSource, /function\s+replaceImportDataSafely_/);
  assert.match(pageSource, /minor === 2 && patch >= 1/);
});

test("batch imports can append prepared rows without reassigning a constant", () => {
  assert.match(appsScriptSource, /let\s+nextCompletionRows\s*=\s*retainedRows\.slice\(\)/);
  assert.doesNotMatch(appsScriptSource, /const\s+nextCompletionRows\s*=\s*retainedRows\.slice\(\)/);
});

test("multi-month uploads import one month at a time and refresh the selected dashboard", () => {
  assert.match(
    pageSource,
    /for\s*\(let index = 0; index < preview\.periods\.length; index \+= 1\)/,
  );
  assert.match(pageSource, /periods:\s*\[\{\s*periodKey:\s*period\.periodKey/);
  assert.match(pageSource, /await loadDashboard\("month", latestPeriod\.periodKey\)/);
  assert.match(pageSource, /finished and remain saved\. Check Manage Uploads before trying again\./);
});

test("dashboard supports an inclusive between-dates view", () => {
  assert.match(pageSource, /<option value="range"[^>]*>Between Dates<\/option>/);
  assert.match(pageSource, /type="date" value=\{rangeStart\}/);
  assert.match(pageSource, /type="date" value=\{rangeEnd\}/);
  assert.match(pageSource, /onClick=\{applyDateRange\}/);
  assert.match(appsScriptSource, /\["month", "year", "range", "all"\]/);
  assert.match(appsScriptSource, /completionDate >= dateRange\.startDate && completionDate <= dateRange\.endDate/);
});

test("frontend uses the current Apps Script deployment", () => {
  assert.match(
    configSource,
    /AKfycbxxlAtOJJZKmV3eB9pXpycVlo26OMXutP8saC0a_-Gbz-chnx8Sx14hodPYzOI84O8r/,
  );
  assert.match(
    configSource,
    /legacyApiUrls:[\s\S]*AKfycbz6DjEd3WdowFVDk1fs8YZhHD-f1eR043QRlkkHNHbfHyPDEBFU3AIscICJdBI-YQ6C/,
  );
});
