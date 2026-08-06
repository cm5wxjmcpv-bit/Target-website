export const TARGET_SOURCE_HEADERS = [
  "First Name",
  "Last Name",
  "Employee ID",
  "User Status",
  "TS UserID",
  "Rank",
  "Shift",
  "Assignment Name",
  "Assignment Type",
  "Assignment Method",
  "Completion Date",
  "Completion Time",
  "Time Spent In Course",
  "Test Score",
  "Validated By",
  "Recorded By",
  "Date Submitted",
  "Tags",
  "Course ID",
  "Transcript ID",
  "Event Instructor",
  "Event Location",
  "Duration (hours)",
  "Training Type",
  "Training Category",
  "Method of Instruction",
  "Instructor",
  "Agency",
  "Location",
  "Number Installed",
  "Additional Information",
  "Objectives",
  "Drill Site",
  "Class/School Name",
  "Provider",
] as const;

export type CompletionDateParts = {
  month: number;
  day: number;
  year: number;
};

function normalizedHeader(value: string) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const canonicalHeaders = new Map(
  TARGET_SOURCE_HEADERS.map((header) => [normalizedHeader(header), header]),
);

export function canonicalizeHeader(value: string) {
  const clean = String(value || "").replace(/^\uFEFF/, "").trim();
  return canonicalHeaders.get(normalizedHeader(clean)) || clean;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  const cleanText = String(text || "").replace(/^\uFEFF/, "");
  for (let index = 0; index < cleanText.length; index += 1) {
    const char = cleanText[index];
    const next = cleanText[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => cell !== "")) rows.push(row);
  }
  return rows;
}

export function findTargetHeaderIndex(rows: string[][]) {
  return rows.findIndex((row) => {
    return canonicalizeHeader(row[0] || "") === "First Name"
      && canonicalizeHeader(row[1] || "") === "Last Name";
  });
}

export function parseCompletionDate(value: string): CompletionDateParts | null {
  const match = String(value || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return { month, day, year };
}

export function periodLabel(periodKey: string) {
  const match = String(periodKey || "").match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) return "Unknown reporting period";
  const year = Number(match[1]);
  const month = Number(match[2]);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

function canonicalValue(value: string | undefined) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function completionRecordKey(record: Record<string, string>) {
  const transcriptId = canonicalValue(record["Transcript ID"]);
  if (transcriptId) return `transcript|${transcriptId}`;
  return [
    "fallback",
    canonicalValue(record["Employee ID"] || record["TS UserID"]),
    canonicalValue(record["Assignment Name"]),
    canonicalValue(record["Completion Date"]),
    canonicalValue(record["Completion Time"]),
    canonicalValue(record["Course ID"]),
  ].join("|");
}

export function duplicateRecordCount(records: Record<string, string>[]) {
  const seen = new Set<string>();
  let duplicates = 0;
  records.forEach((record) => {
    const key = completionRecordKey(record);
    if (seen.has(key)) duplicates += 1;
    else seen.add(key);
  });
  return duplicates;
}
