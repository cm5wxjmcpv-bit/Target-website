"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { APP_CONFIG } from "./config";

type ViewMode = "month" | "year" | "all";

type UserSession = {
  token: string;
  displayName: string;
  username: string;
  role: string;
};

type DashboardRecord = {
  categoryKey: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  shift: string;
  rank: string;
  assignmentName: string;
  assignmentType: string;
  completionDate: string;
  completionTime: string;
  documentedHours: number;
  instructor: string;
  location: string;
};

type CategoryTotal = {
  key: string;
  label: string;
  section: string;
  count: number;
  hours: number;
};

type DashboardData = {
  selectedPeriod: string;
  periodLabel: string;
  viewMode: ViewMode;
  periods: string[];
  years: string[];
  totals: {
    completions: number;
    employees: number;
    hours: number;
    hoursRecords: number;
    missingHours: number;
    training: number;
  };
  sections: {
    operations: number;
    daily: number;
    fireMarshal: number;
    uncategorized: number;
  };
  categories: CategoryTotal[];
  records: DashboardRecord[];
  lastImport: {
    fileName: string;
    periodKey: string;
    importedAt: string;
    rowCount: number;
  } | null;
};

type ImportPreview = {
  fileName: string;
  records: Record<string, string>[];
  periodKey: string;
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
  employeeCount: number;
  duplicateCount: number;
};

type ImportHistoryItem = {
  importId: string;
  periodKey: string;
  periodLabel: string;
  fileName: string;
  importedAt: string;
  importedBy: string;
  rowCount: number;
  activeRecordCount: number;
  status: string;
};

const CATEGORY_GROUPS = [
  {
    title: "Operations & Checks",
    subtitle: "Apparatus, EMS, and SCBA completion activity",
    keys: ["apparatus_checks", "ems_weekly_checks", "scba_checks"],
  },
  {
    title: "Training",
    subtitle: "All TargetSolutions training types combined",
    keys: ["training"],
  },
  {
    title: "Daily Activities",
    subtitle: "Community service and operational activity",
    keys: [
      "pre_incident_planning",
      "public_ed_in_station",
      "public_ed_off_site",
      "smoke_detector",
      "child_seats",
      "other_activities",
    ],
  },
  {
    title: "Fire Marshal",
    subtitle: "Prevention, inspection, investigation, and special operations",
    keys: [
      "fire_inspection",
      "building_inspection",
      "drone_flights",
      "fire_permits",
      "swat_activation",
      "swat_training",
      "fire_investigations",
    ],
  },
  {
    title: "Needs Review",
    subtitle: "Records that did not match an active category rule",
    keys: ["uncategorized"],
  },
] as const;

const DEMO_CATEGORIES: CategoryTotal[] = [
  { key: "apparatus_checks", label: "Apparatus Checks", section: "operations", count: 251, hours: 0 },
  { key: "ems_weekly_checks", label: "EMS Weekly Checks", section: "operations", count: 17, hours: 0 },
  { key: "scba_checks", label: "SCBA Checks", section: "operations", count: 15, hours: 3.75 },
  { key: "training", label: "Training", section: "training", count: 350, hours: 764.46 },
  { key: "pre_incident_planning", label: "Pre-incident Planning", section: "daily", count: 0, hours: 0 },
  { key: "public_ed_in_station", label: "Public Ed In Station", section: "daily", count: 0, hours: 0 },
  { key: "public_ed_off_site", label: "Public Ed Off Site", section: "daily", count: 8, hours: 12 },
  { key: "smoke_detector", label: "Smoke Detector", section: "daily", count: 4, hours: 2 },
  { key: "child_seats", label: "Child Seats", section: "daily", count: 13, hours: 6.5 },
  { key: "other_activities", label: "Other Activities", section: "daily", count: 6, hours: 1 },
  { key: "fire_inspection", label: "Fire Inspection", section: "fireMarshal", count: 17, hours: 0 },
  { key: "building_inspection", label: "Building Inspection", section: "fireMarshal", count: 6, hours: 0 },
  { key: "drone_flights", label: "Drone Flights", section: "fireMarshal", count: 2, hours: 1 },
  { key: "fire_permits", label: "Fire Permits", section: "fireMarshal", count: 1, hours: 0 },
  { key: "swat_activation", label: "SWAT Activation", section: "fireMarshal", count: 0, hours: 0 },
  { key: "swat_training", label: "SWAT Training", section: "fireMarshal", count: 2, hours: 3 },
  { key: "fire_investigations", label: "Fire Investigations", section: "fireMarshal", count: 0, hours: 0 },
  { key: "uncategorized", label: "Uncategorized", section: "uncategorized", count: 0, hours: 0 },
];

const DEMO_DATA: DashboardData = {
  selectedPeriod: "2026-06",
  periodLabel: "June 2026",
  viewMode: "month",
  periods: ["2026-06"],
  years: ["2026"],
  totals: {
    completions: 692,
    employees: 34,
    hours: 783.71,
    hoursRecords: 418,
    missingHours: 274,
    training: 350,
  },
  sections: { operations: 283, daily: 31, fireMarshal: 28, uncategorized: 0 },
  categories: DEMO_CATEGORIES,
  records: [
    {
      categoryKey: "training",
      firstName: "Michael",
      lastName: "Barrett",
      employeeId: "Barr02",
      shift: "C-Shift",
      rank: "Firefighter",
      assignmentName: "Company Training - MF-EMS",
      assignmentType: "MF-EMS Training",
      completionDate: "06/30/2026",
      completionTime: "03:00 PM",
      documentedHours: 7,
      instructor: "Eric Dillon",
      location: "HCDPS",
    },
    {
      categoryKey: "apparatus_checks",
      firstName: "Donald",
      lastName: "Workman",
      employeeId: "0191",
      shift: "B-Shift",
      rank: "Firefighter",
      assignmentName: "Engine 2 - Daily Check",
      assignmentType: "Apparatus Checks",
      completionDate: "06/01/2026",
      completionTime: "06:58 AM",
      documentedHours: 0,
      instructor: "",
      location: "",
    },
  ],
  lastImport: {
    fileName: "Monthly_Master_Completions_06_2026.csv",
    periodKey: "2026-06",
    importedAt: "July 27, 2026 at 1:21 PM",
    rowCount: 692,
  },
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatHours(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value || 0);
}

function documentedHourLabel(value: number) {
  return `${formatHours(value)} documented ${value === 1 ? "hour" : "hours"}`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

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

function dateParts(value: string) {
  const match = String(value || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  return { month: Number(match[1]), day: Number(match[2]), year: Number(match[3]) };
}

function periodLabel(periodKey: string) {
  const match = String(periodKey || "").match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) return "Unknown reporting period";
  const year = Number(match[1]);
  const month = Number(match[2]);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

async function callApi(apiUrl: string, payload: Record<string, unknown>) {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  const result = JSON.parse(text);
  if (!result.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

export default function Home() {
  const [apiUrl, setApiUrl] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"unknown" | "connected" | "uninitialized" | "error">("unknown");
  const [session, setSession] = useState<UserSession | null>(null);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [importsOpen, setImportsOpen] = useState(false);
  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState("");
  const [selectedImport, setSelectedImport] = useState<ImportHistoryItem | null>(null);
  const [importRecords, setImportRecords] = useState<DashboardRecord[]>([]);
  const [importRecordSearch, setImportRecordSearch] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryTotal | null>(null);
  const [recordSearch, setRecordSearch] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const queryDemo = new URLSearchParams(window.location.search).get("demo") === "1";
      const storedApiUrl = window.localStorage.getItem(APP_CONFIG.apiStorageKey) || APP_CONFIG.apiUrl;
      const storedSession = window.sessionStorage.getItem(APP_CONFIG.sessionStorageKey);

      setDemoMode(queryDemo);
      setApiUrl(storedApiUrl);
      if (storedSession) {
        try {
          setSession(JSON.parse(storedSession));
        } catch {
          window.sessionStorage.removeItem(APP_CONFIG.sessionStorageKey);
        }
      }

      if (queryDemo) {
        setBackendStatus("connected");
        return;
      }
      if (storedApiUrl) {
        void checkBackend(storedApiUrl);
      } else {
        setBackendStatus("error");
      }
    }, 0);
    return () => window.clearTimeout(timer);
    // checkBackend intentionally runs once with the browser-stored URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => {
      if (demoMode) {
        setDashboard({ ...DEMO_DATA, viewMode, selectedPeriod: selectedPeriod || DEMO_DATA.selectedPeriod });
        if (!selectedPeriod) setSelectedPeriod(DEMO_DATA.selectedPeriod);
        return;
      }
      void loadDashboard(viewMode, selectedPeriod);
    }, 0);
    return () => window.clearTimeout(timer);
    // The initial dashboard load is tied to a successful login/session restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, demoMode]);

  async function checkBackend(url = apiUrl) {
    if (!url) {
      setBackendStatus("error");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await callApi(url, { action: "status" });
      setBackendStatus(result.initialized ? "connected" : "uninitialized");
      setMessage(result.initialized ? "Google Sheets is connected." : "Connected. The database needs to be set up.");
    } catch {
      setBackendStatus("error");
      setError("The Google Apps Script connection could not be verified.");
    } finally {
      setBusy(false);
    }
  }

  async function saveConnection(event: FormEvent) {
    event.preventDefault();
    const cleanUrl = apiUrl.trim();
    if (!cleanUrl.startsWith("https://script.google.com/")) {
      setError("Enter the deployed Google Apps Script web app URL.");
      return;
    }
    window.localStorage.setItem(APP_CONFIG.apiStorageKey, cleanUrl);
    setApiUrl(cleanUrl);
    await checkBackend(cleanUrl);
  }

  async function initializeDatabase() {
    setBusy(true);
    setError("");
    try {
      await callApi(apiUrl, { action: "setup" });
      setBackendStatus("connected");
      setMessage("Database created. Sign in with admin / ChangeMe123!, then change that password in the Users sheet.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Setup failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      let nextSession: UserSession;
      if (demoMode) {
        if (loginUsername !== "demo" || loginPassword !== "demo") throw new Error("Use demo / demo for this preview.");
        nextSession = { token: "demo", displayName: "Dashboard Preview", username: "demo", role: "admin" };
      } else {
        if (backendStatus !== "connected") throw new Error("Connect and set up the Google Sheet first.");
        const result = await callApi(apiUrl, {
          action: "login",
          username: loginUsername,
          password: loginPassword,
        });
        nextSession = result.session;
      }
      window.sessionStorage.setItem(APP_CONFIG.sessionStorageKey, JSON.stringify(nextSession));
      setSession(nextSession);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    if (session && !demoMode) {
      try {
        await callApi(apiUrl, { action: "logout", session: session.token });
      } catch {
        // The local session is still cleared if the server session already expired.
      }
    }
    window.sessionStorage.removeItem(APP_CONFIG.sessionStorageKey);
    setSession(null);
    setDashboard(null);
    setLoginPassword("");
  }

  async function loadDashboard(mode: ViewMode, period: string) {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      if (demoMode) {
        const label = mode === "all" ? "All Time" : mode === "year" ? "2026" : "June 2026";
        const data = { ...DEMO_DATA, viewMode: mode, periodLabel: label, selectedPeriod: mode === "year" ? "2026" : "2026-06" };
        setDashboard(data);
        setSelectedPeriod(data.selectedPeriod);
        return;
      }
      const result = await callApi(apiUrl, {
        action: "getDashboard",
        session: session.token,
        viewMode: mode,
        period,
      });
      setDashboard(result.dashboard);
      setSelectedPeriod(result.dashboard.selectedPeriod);
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : "Dashboard data could not be loaded.";
      setError(text);
      if (/session|sign in/i.test(text)) await handleLogout();
    } finally {
      setBusy(false);
    }
  }

  function changeViewMode(nextMode: ViewMode) {
    setViewMode(nextMode);
    const nextPeriod =
      nextMode === "month"
        ? dashboard?.periods[0] || ""
        : nextMode === "year"
          ? dashboard?.years[0] || ""
          : "all";
    setSelectedPeriod(nextPeriod);
    void loadDashboard(nextMode, nextPeriod);
  }

  function changePeriod(nextPeriod: string) {
    setSelectedPeriod(nextPeriod);
    void loadDashboard(viewMode, nextPeriod);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setMessage("");
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const headerIndex = rows.findIndex((row) => row[0] === "First Name" && row[1] === "Last Name");
      if (headerIndex < 0) throw new Error("This does not appear to be a TargetSolutions Master Completions CSV.");

      const headers = rows[headerIndex].map((header) => header.trim());
      const required = ["First Name", "Last Name", "Employee ID", "Assignment Name", "Completion Date", "Transcript ID"];
      const missing = required.filter((header) => !headers.includes(header));
      if (missing.length) throw new Error(`The report is missing required columns: ${missing.join(", ")}`);

      const records = rows
        .slice(headerIndex + 1)
        .filter((row) => row.some((cell) => cell.trim() !== ""))
        .map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] || "").trim()])));
      if (!records.length) throw new Error("The report does not contain any completion records.");

      const dates = records
        .map((record) => ({ raw: record["Completion Date"], parts: dateParts(record["Completion Date"]) }))
        .filter((item): item is { raw: string; parts: NonNullable<ReturnType<typeof dateParts>> } => Boolean(item.parts))
        .sort((a, b) => {
          const left = a.parts.year * 10000 + a.parts.month * 100 + a.parts.day;
          const right = b.parts.year * 10000 + b.parts.month * 100 + b.parts.day;
          return left - right;
        });
      if (!dates.length) throw new Error("No valid completion dates were found.");

      const first = dates[0];
      const last = dates[dates.length - 1];
      if (first.parts.year !== last.parts.year || first.parts.month !== last.parts.month) {
        throw new Error("The uploaded file contains more than one completion month. Upload one monthly report at a time.");
      }

      const periodKey = `${first.parts.year}-${String(first.parts.month).padStart(2, "0")}`;
      const employees = new Set(records.map((record) => record["Employee ID"] || `${record["First Name"]} ${record["Last Name"]}`));
      const transcripts = records.map((record) => record["Transcript ID"]).filter(Boolean);
      const duplicateCount = transcripts.length - new Set(transcripts).size;

      setImportPreview({
        fileName: file.name,
        records,
        periodKey,
        periodLabel: periodLabel(periodKey),
        dateFrom: first.raw,
        dateTo: last.raw,
        employeeCount: employees.size,
        duplicateCount,
      });
    } catch (caught) {
      setImportPreview(null);
      setError(caught instanceof Error ? caught.message : "The file could not be read.");
    }
  }

  async function importReport() {
    if (!importPreview || !session || demoMode) return;
    setBusy(true);
    setError("");
    try {
      const result = await callApi(apiUrl, {
        action: "importReport",
        session: session.token,
        fileName: importPreview.fileName,
        periodKey: importPreview.periodKey,
        records: importPreview.records,
        replaceExisting: true,
      });
      setUploadOpen(false);
      setImportPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setViewMode("month");
      setSelectedPeriod(importPreview.periodKey);
      setDashboard(result.dashboard);
      const skipped = Number(result.duplicateRowsSkipped) || 0;
      setMessage(
        `${formatNumber(result.importedRows)} records imported for ${importPreview.periodLabel}.` +
        (skipped ? ` ${formatNumber(skipped)} duplicate ${skipped === 1 ? "record was" : "records were"} skipped.` : ""),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The report could not be imported.");
    } finally {
      setBusy(false);
    }
  }

  async function openImportHistory() {
    if (!session) return;
    if (demoMode) {
      setImportHistory([
        {
          importId: "demo-current",
          periodKey: "2026-06",
          periodLabel: "June 2026",
          fileName: "Monthly_Master_Completions_06_2026.csv",
          importedAt: "Jul 28, 2026 2:12 PM",
          importedBy: "Mlackey",
          rowCount: 692,
          activeRecordCount: 692,
          status: "Active",
        },
        {
          importId: "demo-duplicate",
          periodKey: "2026-06",
          periodLabel: "June 2026",
          fileName: "Monthly_Master_Completions_06_2026.csv",
          importedAt: "Jul 28, 2026 2:04 PM",
          importedBy: "Mlackey",
          rowCount: 692,
          activeRecordCount: 692,
          status: "Active",
        },
      ]);
      setConfirmDeleteId("");
      setImportsOpen(true);
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await callApi(apiUrl, {
        action: "listImports",
        session: session.token,
      });
      setImportHistory(result.imports || []);
      setConfirmDeleteId("");
      setImportsOpen(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Uploaded reports could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteImport(importId: string) {
    if (!session) return;
    if (demoMode) {
      setImportHistory((items) =>
        items.map((item) =>
          item.importId === importId ? { ...item, activeRecordCount: 0, status: "Deleted" } : item,
        ),
      );
      setConfirmDeleteId("");
      setSelectedImport(null);
      setMessage("Preview only: the selected upload would be deleted.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await callApi(apiUrl, {
        action: "deleteImport",
        session: session.token,
        importId,
        viewMode,
        period: selectedPeriod,
      });
      setImportHistory(result.imports || []);
      setDashboard(result.dashboard);
      setSelectedPeriod(result.dashboard.selectedPeriod);
      setConfirmDeleteId("");
      setMessage(
        `${formatNumber(result.deletedRows || 0)} completion ${result.deletedRows === 1 ? "record was" : "records were"} removed.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The uploaded report could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  async function openImportRecords(item: ImportHistoryItem) {
    if (!session || !item.activeRecordCount) return;
    if (demoMode) {
      setSelectedImport(item);
      setImportRecords(DEMO_DATA.records);
      setImportRecordSearch("");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await callApi(apiUrl, {
        action: "getImportRecords",
        session: session.token,
        importId: item.importId,
      });
      setSelectedImport(item);
      setImportRecords(result.records || []);
      setImportRecordSearch("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The uploaded report could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  const categoryRecords = useMemo(() => {
    if (!selectedCategory || !dashboard) return [];
    const needle = recordSearch.trim().toLowerCase();
    return dashboard.records.filter((record) => {
      if (record.categoryKey !== selectedCategory.key) return false;
      if (!needle) return true;
      return Object.values(record).some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [dashboard, recordSearch, selectedCategory]);

  const visibleImportRecords = useMemo(() => {
    const needle = importRecordSearch.trim().toLowerCase();
    if (!needle) return importRecords;
    return importRecords.filter((record) =>
      Object.values(record).some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [importRecordSearch, importRecords]);

  if (!session) {
    return (
      <main className="login-page">
        <section className="login-brand">
          <div className="brand-mark large" aria-hidden="true">
            <span>MF</span>
            <small>EMS</small>
          </div>
          <p className="eyebrow">Martinsville Fire & EMS</p>
          <h1>Monthly activity, clearly reported.</h1>
          <p className="login-intro">
            Upload the TargetSolutions completion report and see the month, year, or all-time totals in one place.
          </p>
          <div className="login-feature-row">
            <span>Monthly uploads</span>
            <span>Yearly totals</span>
            <span>All-time view</span>
          </div>
        </section>

        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-card">
            <p className="eyebrow blue">Secure dashboard</p>
            <h2 id="login-title">Sign in</h2>
            <p>Use the username and password listed on the Google Sheet’s Users tab.</p>

            {demoMode && <div className="notice info">Preview login: <strong>demo</strong> / <strong>demo</strong></div>}
            {error && <div className="notice error" role="alert">{error}</div>}
            {message && <div className="notice success">{message}</div>}

            <form onSubmit={handleLogin} className="stack-form">
              <label>
                Username
                <input
                  value={loginUsername}
                  onChange={(event) => setLoginUsername(event.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button className="primary-button full" disabled={busy}>
                {busy ? "Please wait…" : "Sign in"}
              </button>
            </form>

            {!demoMode && (
              <button className="text-button setup-link" type="button" onClick={() => setSetupOpen((open) => !open)}>
                {setupOpen ? "Hide database setup" : "Database setup"}
              </button>
            )}

            {setupOpen && !demoMode && (
              <form className="setup-box" onSubmit={saveConnection}>
                <label>
                  Apps Script web app URL
                  <input
                    value={apiUrl}
                    onChange={(event) => setApiUrl(event.target.value)}
                    placeholder="https://script.google.com/macros/s/…/exec"
                    required
                  />
                </label>
                <div className="button-row">
                  <button className="secondary-button" disabled={busy}>Connect</button>
                  {backendStatus === "uninitialized" && (
                    <button className="primary-button" type="button" onClick={initializeDatabase} disabled={busy}>
                      Set Up Sheets
                    </button>
                  )}
                </div>
                <p className={`connection-status ${backendStatus}`}>
                  {backendStatus === "connected" && "Connected and ready"}
                  {backendStatus === "uninitialized" && "Connected — setup required"}
                  {backendStatus === "error" && "Not connected"}
                  {backendStatus === "unknown" && "Enter the deployed web app URL"}
                </p>
              </form>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <span>MF</span>
            <small>EMS</small>
          </div>
          <div>
            <strong>Martinsville Fire & EMS</strong>
            <span>TargetSolutions Dashboard</span>
          </div>
        </div>

        <div className="header-actions">
          {session.role === "admin" && (
            <div className="report-actions">
              <button className="manage-button" onClick={() => void openImportHistory()} disabled={busy}>
                Manage Uploads
              </button>
              <button className="upload-button" onClick={() => setUploadOpen(true)}>
                <span aria-hidden="true">↑</span> Upload Report
              </button>
            </div>
          )}
          <div className="user-menu">
            <span className="user-avatar">{session.displayName.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{session.displayName}</strong>
              <button onClick={handleLogout}>Sign out</button>
            </div>
          </div>
        </div>
      </header>

      <div className="dashboard-wrap">
        <section className="dashboard-heading">
          <div>
            <p className="eyebrow blue">Completion overview</p>
            <h1>{dashboard?.periodLabel || "Dashboard"}</h1>
            <p>TargetSolutions completion activity for the selected reporting period.</p>
          </div>

          <div className="period-controls" aria-label="Reporting period">
            <label>
              View
              <select value={viewMode} onChange={(event) => changeViewMode(event.target.value as ViewMode)}>
                <option value="month">Month</option>
                <option value="year">Year</option>
                <option value="all">All Time</option>
              </select>
            </label>
            {viewMode !== "all" && (
              <label>
                Period
                <select value={selectedPeriod} onChange={(event) => changePeriod(event.target.value)}>
                  {(viewMode === "month" ? dashboard?.periods : dashboard?.years)?.map((period) => (
                    <option key={period} value={period}>
                      {viewMode === "month" ? periodLabel(period) : period}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </section>

        {error && <div className="notice error dashboard-notice" role="alert">{error}</div>}
        {message && <div className="notice success dashboard-notice">{message}</div>}
        {demoMode && <div className="demo-banner">Dashboard preview using the June 2026 sample report.</div>}

        <section className="summary-grid" aria-label="Summary totals">
          <article className="summary-card featured">
            <span>Total completions</span>
            <strong>{formatNumber(dashboard?.totals.completions || 0)}</strong>
            <small>All completed records</small>
          </article>
          <article className="summary-card">
            <span>Employees with activity</span>
            <strong>{formatNumber(dashboard?.totals.employees || 0)}</strong>
            <small>Unique employees</small>
          </article>
          <article className="summary-card">
            <span>Documented hours</span>
            <strong>{formatHours(dashboard?.totals.hours || 0)}</strong>
            <small>{formatNumber(dashboard?.totals.hoursRecords || 0)} records include time</small>
          </article>
          <article className="summary-card">
            <span>Training</span>
            <strong>{formatNumber(dashboard?.totals.training || 0)}</strong>
            <small>All training types combined</small>
          </article>
        </section>

        <section className="section-total-grid" aria-label="Department sections">
          <article><span>Operations & Checks</span><strong>{formatNumber(dashboard?.sections.operations || 0)}</strong></article>
          <article><span>Daily Activities</span><strong>{formatNumber(dashboard?.sections.daily || 0)}</strong></article>
          <article><span>Fire Marshal</span><strong>{formatNumber(dashboard?.sections.fireMarshal || 0)}</strong></article>
          <article className={dashboard?.sections.uncategorized ? "warning" : ""}>
            <span>Needs Review</span><strong>{formatNumber(dashboard?.sections.uncategorized || 0)}</strong>
          </article>
        </section>

        <section className="hours-note">
          <span aria-hidden="true">i</span>
          <p>
            Completion counts include every record. Documented hours only include records with a duration or course time.
            <strong> {formatNumber(dashboard?.totals.missingHours || 0)} records do not include documented time.</strong>
          </p>
        </section>

        {CATEGORY_GROUPS.map((group) => {
          const cards = group.keys
            .map((key) => dashboard?.categories.find((category) => category.key === key))
            .filter((category): category is CategoryTotal => Boolean(category));
          return (
            <section className="category-section" key={group.title}>
              <div className="section-heading">
                <div>
                  <h2>{group.title}</h2>
                  <p>{group.subtitle}</p>
                </div>
              </div>
              <div className={`category-grid ${cards.length === 1 ? "single" : ""}`}>
                {cards.map((category) => (
                  <button
                    className={`category-card ${category.key === "uncategorized" && category.count ? "warning" : ""}`}
                    key={category.key}
                    onClick={() => {
                      setSelectedCategory(category);
                      setRecordSearch("");
                    }}
                  >
                    <span>{category.label}</span>
                    <strong>{formatNumber(category.count)}</strong>
                    <small>{category.hours ? documentedHourLabel(category.hours) : "View completed records"}</small>
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        <footer className="dashboard-footer">
          <div>
            <strong>Last import</strong>
            <span>
              {dashboard?.lastImport
                ? `${dashboard.lastImport.fileName} · ${formatNumber(dashboard.lastImport.rowCount)} records · ${dashboard.lastImport.importedAt}`
                : "No reports uploaded yet"}
            </span>
          </div>
          <span>{busy ? "Updating dashboard…" : "Dashboard ready"}</span>
        </footer>
      </div>

      {uploadOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !busy && setUploadOpen(false)}>
          <section className="modal-card upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow blue">Monthly report</p>
                <h2 id="upload-title">Upload TargetSolutions CSV</h2>
              </div>
              <button className="close-button" onClick={() => setUploadOpen(false)} aria-label="Close">×</button>
            </div>

            {demoMode && (
              <div className="notice info">Preview mode can validate a report, but it will not save the file.</div>
            )}
            <label className="file-drop">
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} />
              <span className="file-icon">CSV</span>
              <strong>Select the Monthly Master Completions file</strong>
              <small>The report will be checked before anything is saved.</small>
            </label>

            {importPreview && (
              <div className="import-preview">
                <div className="preview-title">
                  <div>
                    <strong>{importPreview.periodLabel}</strong>
                    <span>{importPreview.fileName}</span>
                  </div>
                  <span className="ready-pill">Ready</span>
                </div>
                <div className="preview-grid">
                  <div><span>Records</span><strong>{formatNumber(importPreview.records.length)}</strong></div>
                  <div><span>Employees</span><strong>{formatNumber(importPreview.employeeCount)}</strong></div>
                  <div><span>Date range</span><strong>{importPreview.dateFrom}–{importPreview.dateTo}</strong></div>
                  <div><span>Duplicates in file</span><strong>{formatNumber(importPreview.duplicateCount)}</strong></div>
                </div>
                {dashboard?.periods.includes(importPreview.periodKey) && (
                  <div className="notice warning">
                    {importPreview.periodLabel} was previously uploaded. Continuing will replace that month and prevent duplicate totals.
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setUploadOpen(false)} disabled={busy}>Cancel</button>
              {!demoMode && (
                <button className="primary-button" onClick={importReport} disabled={!importPreview || busy}>
                  {busy ? "Importing…" : "Import & Update Dashboard"}
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {importsOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !busy && setImportsOpen(false)}>
          <section className="modal-card imports-modal" role="dialog" aria-modal="true" aria-labelledby="imports-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow blue">Report administration</p>
                <h2 id="imports-title">Uploaded reports</h2>
                <p>Review every upload and remove a report with its completion records.</p>
              </div>
              <button className="close-button" onClick={() => setImportsOpen(false)} aria-label="Close">×</button>
            </div>

            <div className="table-wrap imports-table-wrap">
              <table className="imports-table">
                <thead>
                  <tr>
                    <th>Reporting period</th>
                    <th>File</th>
                    <th>Uploaded</th>
                    <th>Records</th>
                    <th>Status</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {importHistory.map((item) => (
                    <tr key={item.importId}>
                      <td><strong>{item.periodLabel}</strong></td>
                      <td><strong>{item.fileName}</strong><small>by {item.importedBy || "Unknown user"}</small></td>
                      <td>{item.importedAt || "—"}</td>
                      <td>
                        <strong>{formatNumber(item.activeRecordCount)}</strong>
                        <small>{formatNumber(item.rowCount)} originally uploaded</small>
                      </td>
                      <td>
                        <span className={`status-pill ${item.status.toLowerCase().replace(/\s+/g, "-")}`}>{item.status}</span>
                      </td>
                      <td className="import-actions-cell">
                        {item.activeRecordCount > 0 && (
                          <button className="secondary-text-button" onClick={() => void openImportRecords(item)} disabled={busy}>
                            View records
                          </button>
                        )}
                        {item.status !== "Deleted" && confirmDeleteId !== item.importId && (
                          <button className="danger-text-button" onClick={() => setConfirmDeleteId(item.importId)} disabled={busy}>
                            Delete
                          </button>
                        )}
                        {confirmDeleteId === item.importId && (
                          <div className="inline-confirm">
                            <span>Delete this upload?</span>
                            <button className="danger-button" onClick={() => void deleteImport(item.importId)} disabled={busy}>
                              {busy ? "Deleting…" : "Yes, delete"}
                            </button>
                            <button className="text-button" onClick={() => setConfirmDeleteId("")} disabled={busy}>Cancel</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!importHistory.length && (
                    <tr><td className="empty-table" colSpan={6}>No reports have been uploaded.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setImportsOpen(false)} disabled={busy}>Close</button>
            </div>
          </section>
        </div>
      )}

      {selectedImport && (
        <div className="modal-backdrop detail-backdrop" role="presentation" onMouseDown={() => setSelectedImport(null)}>
          <section className="modal-card records-modal" role="dialog" aria-modal="true" aria-labelledby="import-records-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow blue">{selectedImport.periodLabel}</p>
                <h2 id="import-records-title">{selectedImport.fileName}</h2>
                <p>{formatNumber(importRecords.length)} active completion records · uploaded {selectedImport.importedAt}</p>
              </div>
              <button className="close-button" onClick={() => setSelectedImport(null)} aria-label="Close">×</button>
            </div>
            <label className="record-search">
              <span className="sr-only">Search this upload</span>
              <input
                value={importRecordSearch}
                onChange={(event) => setImportRecordSearch(event.target.value)}
                placeholder="Search employee, training, shift, or date"
              />
            </label>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Training / Activity</th>
                    <th>Type</th>
                    <th>Completed</th>
                    <th>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleImportRecords.map((record, index) => (
                    <tr key={`${record.employeeId}-${record.assignmentName}-${record.completionDate}-${index}`}>
                      <td>
                        <strong>{`${record.firstName} ${record.lastName}`.trim() || "Unknown"}</strong>
                        <small>{record.employeeId || record.rank || "—"}</small>
                      </td>
                      <td>
                        <strong>{record.assignmentName || "Untitled record"}</strong>
                        <small>{record.location || record.instructor || "—"}</small>
                      </td>
                      <td>{record.assignmentType || "—"}</td>
                      <td>{record.completionDate || "—"}<small>{record.completionTime || ""}</small></td>
                      <td>{record.documentedHours ? formatHours(record.documentedHours) : "—"}</td>
                    </tr>
                  ))}
                  {!visibleImportRecords.length && (
                    <tr><td className="empty-table" colSpan={5}>No matching records.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {selectedCategory && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelectedCategory(null)}>
          <section className="modal-card records-modal" role="dialog" aria-modal="true" aria-labelledby="records-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow blue">{dashboard?.periodLabel}</p>
                <h2 id="records-title">{selectedCategory.label}</h2>
                <p>{formatNumber(selectedCategory.count)} completed records</p>
              </div>
              <button className="close-button" onClick={() => setSelectedCategory(null)} aria-label="Close">×</button>
            </div>
            <label className="record-search">
              <span className="sr-only">Search records</span>
              <input
                value={recordSearch}
                onChange={(event) => setRecordSearch(event.target.value)}
                placeholder="Search employee, assignment, shift, or date"
              />
            </label>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Assignment</th>
                    <th>Shift</th>
                    <th>Date</th>
                    <th>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryRecords.map((record, index) => (
                    <tr key={`${record.employeeId}-${record.assignmentName}-${record.completionDate}-${index}`}>
                      <td><strong>{record.firstName} {record.lastName}</strong><small>{record.rank}</small></td>
                      <td><strong>{record.assignmentName}</strong><small>{record.assignmentType}</small></td>
                      <td>{record.shift || "—"}</td>
                      <td>{record.completionDate}<small>{record.completionTime}</small></td>
                      <td>{record.documentedHours ? formatHours(record.documentedHours) : "—"}</td>
                    </tr>
                  ))}
                  {!categoryRecords.length && (
                    <tr><td className="empty-table" colSpan={5}>No matching records for this category and period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
