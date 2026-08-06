import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadTypeScriptModule(relativePath) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleShim = { exports: {} };
  const context = vm.createContext({
    Date,
    Intl,
    Map,
    Set,
    module: moduleShim,
    exports: moduleShim.exports,
  });
  vm.runInContext(output, context);
  return moduleShim.exports;
}

const report = loadTypeScriptModule("../app/report-utils.ts");

test("accepts a UTF-8 BOM and canonicalizes TargetSolutions headers", () => {
  const rows = report.parseCsv(
    "\uFEFFReport generated,,,,\nFirst   Name, last name,Employee ID,Assignment Name,Completion Date,Transcript ID\nMicah,Lackey,100,Training,01/15/2026,T-1\n",
  );
  const headerIndex = report.findTargetHeaderIndex(rows);

  assert.equal(headerIndex, 1);
  assert.deepEqual(
    Array.from(rows[headerIndex].map(report.canonicalizeHeader).slice(0, 2)),
    ["First Name", "Last Name"],
  );
});

test("rejects impossible calendar dates", () => {
  assert.equal(report.parseCompletionDate("13/40/2026"), null);
  assert.equal(report.parseCompletionDate("02/29/2025"), null);
  assert.deepEqual(
    { ...report.parseCompletionDate("02/29/2024") },
    { month: 2, day: 29, year: 2024 },
  );
});

test("counts duplicate transcript and fallback completion records", () => {
  const records = [
    { "Transcript ID": "ABC-1" },
    { "Transcript ID": "abc-1" },
    {
      "Employee ID": "100",
      "Assignment Name": "Company Training",
      "Completion Date": "01/15/2026",
      "Completion Time": "08:00 AM",
      "Course ID": "C-1",
    },
    {
      "Employee ID": "100",
      "Assignment Name": " Company  Training ",
      "Completion Date": "01/15/2026",
      "Completion Time": "08:00 AM",
      "Course ID": "C-1",
    },
  ];

  assert.equal(report.duplicateRecordCount(records), 2);
});
