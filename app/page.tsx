"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { APP_CONFIG } from "./config";
import {
  canonicalizeHeader,
  duplicateRecordCount,
  findTargetHeaderIndex,
  parseCompletionDate,
  parseCsv,
  periodLabel,
} from "./report-utils";

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

type ImportPeriodPreview = {
  records: Record<string, string>[];
  periodKey: string;
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
  employeeCount: number;
  duplicateCount: number;
};

type ImportPreview = {
  fileName: string;
  records: Record<string, string>[];
  periods: ImportPeriodPreview[];
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatHours(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function supportsUploadManagement(version: string) {
  const parts = String(version || "").split(".").map(Number);
  return (parts[0] || 0) > 1 || ((parts[0] || 0) === 1 && (parts[1] || 0) >= 1);
}

function supportsSafeBatchImport(version: string) {
  const parts = String(version || "").split(".").map(Number);
  const major = parts[0] || 0;
  const minor = parts[1] || 0;
  const patch = parts[2] || 0;
  return major > 1 || (major === 1 && (minor > 2 || (minor === 2 && patch >= 1)));
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
  const [backendVersion, setBackendVersion] = useState("");
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
  const [importProgress, setImportProgress] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryTotal | null>(null);
  const [selectedCategoryRecords, setSelectedCategoryRecords] = useState<DashboardRecord[]>([]);
  const [categoryRecordsLoading, setCategoryRecordsLoading] = useState(false);
  const [recordSearch, setRecordSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const dashboardRequestRef = useRef(0);
  const uploadDialogRef = useRef<HTMLElement>(null);
  const importsDialogRef = useRef<HTMLElement>(null);
  const importRecordsDialogRef = useRef<HTMLElement>(null);
  const categoryRecordsDialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedApiUrl = window.localStorage.getItem(APP_CONFIG.apiStorageKey) || "";
      const storedApiUrl =
        !savedApiUrl || (APP_CONFIG.legacyApiUrls as readonly string[]).includes(savedApiUrl)
          ? APP_CONFIG.apiUrl
          : savedApiUrl;
      const storedSession = window.sessionStorage.getItem(APP_CONFIG.sessionStorageKey);

      if (storedApiUrl !== savedApiUrl) {
        window.localStorage.setItem(APP_CONFIG.apiStorageKey, storedApiUrl);
      }
      setApiUrl(storedApiUrl);
      if (storedSession) {
        try {
          const parsedSession = JSON.parse(storedSession) as UserSession;
          if (parsedSession?.token === "demo") {
            window.sessionStorage.removeItem(APP_CONFIG.sessionStorageKey);
          } else {
            setSession(parsedSession);
          }
        } catch {
          window.sessionStorage.removeItem(APP_CONFIG.sessionStorageKey);
        }
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
      void loadDashboard(viewMode, selectedPeriod);
    }, 0);
    return () => window.clearTimeout(timer);
    // The initial dashboard load is tied to a successful login/session restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (!uploadOpen) return;

    function preventBrowserFileOpen(event: globalThis.DragEvent) {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    }

    window.addEventListener("dragover", preventBrowserFileOpen);
    window.addEventListener("drop", preventBrowserFileOpen);
    return () => {
      window.removeEventListener("dragover", preventBrowserFileOpen);
      window.removeEventListener("drop", preventBrowserFileOpen);
    };
  }, [uploadOpen]);

  useEffect(() => {
    const dialog = selectedImport
      ? importRecordsDialogRef.current
      : selectedCategory
        ? categoryRecordsDialogRef.current
        : importsOpen
          ? importsDialogRef.current
          : uploadOpen
            ? uploadDialogRef.current
            : null;
    if (!dialog) return;
    const activeDialog = dialog;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableSelector = [
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[href]",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");
    const focusFirst = window.setTimeout(() => {
      activeDialog.querySelector<HTMLElement>(focusableSelector)?.focus();
    }, 0);

    function handleDialogKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (selectedImport) setSelectedImport(null);
        else if (selectedCategory) setSelectedCategory(null);
        else if (importsOpen && !busy) setImportsOpen(false);
        else if (uploadOpen && !busy) setUploadOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(activeDialog.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => element.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleDialogKeydown);
    return () => {
      window.clearTimeout(focusFirst);
      document.removeEventListener("keydown", handleDialogKeydown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [busy, importsOpen, selectedCategory, selectedImport, uploadOpen]);

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
      setBackendVersion(String(result.version || ""));
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
    const isAgentPreview = window.location.hostname === "terminal.local";
    if (!cleanUrl.startsWith("https://script.google.com/") && !isAgentPreview) {
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
      if (backendStatus !== "connected") throw new Error("Connect and set up the Google Sheet first.");
      const result = await callApi(apiUrl, {
        action: "login",
        username: loginUsername,
        password: loginPassword,
      });
      const nextSession: UserSession = result.session;
      window.sessionStorage.setItem(APP_CONFIG.sessionStorageKey, JSON.stringify(nextSession));
      setSession(nextSession);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    if (session) {
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
    const requestId = dashboardRequestRef.current + 1;
    dashboardRequestRef.current = requestId;
    setBusy(true);
    setError("");
    try {
      const result = await callApi(apiUrl, {
        action: "getDashboard",
        session: session.token,
        viewMode: mode,
        period,
        includeRecords: false,
      });
      if (requestId !== dashboardRequestRef.current) return;
      setDashboard(result.dashboard);
      setSelectedPeriod(result.dashboard.selectedPeriod);
    } catch (caught) {
      if (requestId !== dashboardRequestRef.current) return;
      const text = caught instanceof Error ? caught.message : "Dashboard data could not be loaded.";
      setError(text);
      if (/session|sign in/i.test(text)) await handleLogout();
    } finally {
      if (requestId === dashboardRequestRef.current) setBusy(false);
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

  async function prepareFile(file: File) {
    setError("");
    setMessage("");
    try {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        throw new Error("Choose the CSV version of the TargetSolutions report.");
      }

      const text = await file.text();
      const rows = parseCsv(text);
      const headerIndex = findTargetHeaderIndex(rows);
      if (headerIndex < 0) throw new Error("This does not appear to be a TargetSolutions Master Completions CSV.");

      const headers = rows[headerIndex].map(canonicalizeHeader);
      const required = ["First Name", "Last Name", "Employee ID", "Assignment Name", "Completion Date", "Transcript ID"];
      const missing = required.filter((header) => !headers.includes(header));
      if (missing.length) throw new Error(`The report is missing required columns: ${missing.join(", ")}`);

      const records = rows
        .slice(headerIndex + 1)
        .filter((row) => row.some((cell) => cell.trim() !== ""))
        .map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] || "").trim()])));
      if (!records.length) throw new Error("The report does not contain any completion records.");

      const datedRecords = records.map((record) => ({
        record,
        raw: record["Completion Date"],
        parts: parseCompletionDate(record["Completion Date"]),
      }));
      const invalidDateCount = datedRecords.filter((item) => !item.parts).length;
      if (invalidDateCount) {
        throw new Error(
          `${formatNumber(invalidDateCount)} ${invalidDateCount === 1 ? "record has" : "records have"} an invalid completion date.`,
        );
      }

      const dates = datedRecords
        .filter(
          (
            item,
          ): item is {
            record: Record<string, string>;
            raw: string;
            parts: NonNullable<ReturnType<typeof parseCompletionDate>>;
          } => Boolean(item.parts),
        )
        .sort((a, b) => {
          const left = a.parts.year * 10000 + a.parts.month * 100 + a.parts.day;
          const right = b.parts.year * 10000 + b.parts.month * 100 + b.parts.day;
          return left - right;
        });
      if (!dates.length) throw new Error("No valid completion dates were found.");

      const periodGroups = new Map<string, typeof dates>();
      dates.forEach((item) => {
        const key = `${item.parts.year}-${String(item.parts.month).padStart(2, "0")}`;
        const group = periodGroups.get(key) || [];
        group.push(item);
        periodGroups.set(key, group);
      });

      const periods = Array.from(periodGroups.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([periodKey, items]) => {
          const periodRecords = items.map((item) => item.record);
          const periodEmployees = new Set(
            periodRecords.map(
              (record) => record["Employee ID"] || `${record["First Name"]} ${record["Last Name"]}`,
            ),
          );
          return {
            periodKey,
            periodLabel: periodLabel(periodKey),
            records: periodRecords,
            dateFrom: items[0].raw,
            dateTo: items[items.length - 1].raw,
            employeeCount: periodEmployees.size,
            duplicateCount: duplicateRecordCount(periodRecords),
          };
        });

      const first = dates[0];
      const last = dates[dates.length - 1];
      const employees = new Set(records.map((record) => record["Employee ID"] || `${record["First Name"]} ${record["Last Name"]}`));
      const duplicateCount = duplicateRecordCount(records);
      const rangeLabel =
        periods.length === 1
          ? periods[0].periodLabel
          : `${periods[0].periodLabel}–${periods[periods.length - 1].periodLabel}`;

      setImportPreview({
        fileName: file.name,
        records,
        periods,
        periodLabel: rangeLabel,
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

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void prepareFile(file);
  }

  function handleDragEnter(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragActive(true);
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragActive(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragActive(false);
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length !== 1) {
      setImportPreview(null);
      setError("Drop one TargetSolutions CSV file at a time.");
      return;
    }
    void prepareFile(files[0]);
  }

  async function importReport() {
    if (!importPreview || !session) return;
    if (!supportsSafeBatchImport(backendVersion)) {
      setError("Update and redeploy the Google Apps Script backend before importing this report.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setImportProgress(`Validating and importing ${formatNumber(importPreview.periods.length)} ${importPreview.periods.length === 1 ? "month" : "months"}…`);
      const result = await callApi(apiUrl, {
        action: "importReportBatch",
        session: session.token,
        fileName: importPreview.fileName,
        periods: importPreview.periods.map((period) => ({
          periodKey: period.periodKey,
          records: period.records,
        })),
        replaceExisting: true,
      });
      const latestPeriod = importPreview.periods[importPreview.periods.length - 1];
      setUploadOpen(false);
      setImportPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setViewMode("month");
      setSelectedPeriod(latestPeriod.periodKey);
      setDashboard(result.dashboard);

      const importedRows = Number(result.importedRows) || 0;
      const duplicateRowsSkipped = Number(result.duplicateRowsSkipped) || 0;
      const unchangedPeriods = Array.isArray(result.unchangedPeriods) ? result.unchangedPeriods : [];
      const importedMonthCount = Number(result.importedMonthCount) || 0;
      const importedMessage = importedMonthCount
        ? `${formatNumber(importedRows)} records imported across ${formatNumber(importedMonthCount)} ${importedMonthCount === 1 ? "month" : "months"}.`
        : "Every month in this file is already uploaded.";
      const unchangedMessage = unchangedPeriods.length
        ? ` ${formatNumber(unchangedPeriods.length)} unchanged ${unchangedPeriods.length === 1 ? "month was" : "months were"} skipped.`
        : "";
      const duplicateMessage = duplicateRowsSkipped
        ? ` ${formatNumber(duplicateRowsSkipped)} duplicate ${duplicateRowsSkipped === 1 ? "record was" : "records were"} skipped.`
        : "";
      setMessage(importedMessage + unchangedMessage + duplicateMessage);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The report could not be imported.");
    } finally {
      setImportProgress("");
      setBusy(false);
    }
  }

  async function openImportHistory() {
    if (!session) return;
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

  async function openCategoryRecords(category: CategoryTotal) {
    if (!session || !dashboard) return;
    setSelectedCategory(category);
    setSelectedCategoryRecords([]);
    setRecordSearch("");
    setError("");

    if (!category.count) return;
    if (dashboard.records.length) {
      setSelectedCategoryRecords(
        dashboard.records.filter((record) => record.categoryKey === category.key),
      );
      return;
    }

    setCategoryRecordsLoading(true);
    try {
      const result = await callApi(apiUrl, {
        action: "getCategoryRecords",
        session: session.token,
        viewMode,
        period: selectedPeriod,
        categoryKey: category.key,
      });
      setSelectedCategoryRecords(result.records || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The completed records could not be loaded.");
      setSelectedCategory(null);
    } finally {
      setCategoryRecordsLoading(false);
    }
  }

  const categoryRecords = useMemo(() => {
    if (!selectedCategory) return [];
    const needle = recordSearch.trim().toLowerCase();
    return selectedCategoryRecords.filter((record) => {
      if (!needle) return true;
      return Object.values(record).some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [recordSearch, selectedCategory, selectedCategoryRecords]);

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

            <button className="text-button setup-link" type="button" onClick={() => setSetupOpen((open) => !open)}>
              {setupOpen ? "Hide database setup" : "Database setup"}
            </button>

            {setupOpen && (
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
              <button
                className="manage-button"
                onClick={() => void openImportHistory()}
                disabled={busy || !supportsUploadManagement(backendVersion)}
                title={!supportsUploadManagement(backendVersion) ? "Update the Apps Script backend to version 1.1" : undefined}
              >
                Manage Uploads
              </button>
              <button
                className="upload-button"
                onClick={() => {
                  setError("");
                  setMessage("");
                  setImportPreview(null);
                  setUploadOpen(true);
                }}
              >
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

        {error && !uploadOpen && !importsOpen && !selectedImport && !selectedCategory && (
          <div className="notice error dashboard-notice" role="alert">{error}</div>
        )}
        {message && <div className="notice success dashboard-notice">{message}</div>}
        {session.role === "admin" && backendStatus === "connected" && backendVersion && !supportsUploadManagement(backendVersion) && (
          <div className="notice warning dashboard-notice">
            Update and redeploy the Google Apps Script backend to enable Manage Uploads and full duplicate protection.
          </div>
        )}
        {session.role === "admin" && supportsUploadManagement(backendVersion) && !supportsSafeBatchImport(backendVersion) && (
          <div className="notice warning dashboard-notice">
            Update and redeploy the Google Apps Script backend before uploading another report. Existing dashboard data remains available.
          </div>
        )}

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
                    onClick={() => void openCategoryRecords(category)}
                  >
                    <span>{category.label}</span>
                    <div className="category-card-metrics">
                      <div>
                        <strong>{formatNumber(category.count)}</strong>
                        <small>Completions</small>
                      </div>
                      <div>
                        <strong>{formatHours(category.hours)}</strong>
                        <small>Documented hours</small>
                      </div>
                    </div>
                    <small className="category-card-action">View completed records →</small>
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
          <section ref={uploadDialogRef} className="modal-card upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow blue">Monthly report</p>
                <h2 id="upload-title">Upload TargetSolutions CSV</h2>
              </div>
              <button className="close-button" onClick={() => setUploadOpen(false)} aria-label="Close">×</button>
            </div>

            {!supportsSafeBatchImport(backendVersion) && (
              <div className="notice warning">Update and redeploy the Google Apps Script backend before importing. You can still inspect the file preview.</div>
            )}
            {error && <div className="notice error" role="alert">{error}</div>}
            <label
              className={`file-drop ${isDragActive ? "drag-active" : ""}`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} />
              <span className="file-icon">CSV</span>
              <strong>{isDragActive ? "Drop the report here" : "Choose a file or drag it here"}</strong>
              <small>Monthly and multi-month TargetSolutions CSV reports are supported.</small>
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
                  <div><span>Months</span><strong>{formatNumber(importPreview.periods.length)}</strong></div>
                  <div><span>Employees</span><strong>{formatNumber(importPreview.employeeCount)}</strong></div>
                  <div><span>Date range</span><strong>{importPreview.dateFrom}–{importPreview.dateTo}</strong></div>
                  <div><span>Duplicates in file</span><strong>{formatNumber(importPreview.duplicateCount)}</strong></div>
                </div>
                <div className="import-period-list" aria-label="Months included in this file">
                  {importPreview.periods.map((period) => (
                    <span key={period.periodKey}>
                      {period.periodLabel}
                      <strong>{formatNumber(period.records.length)} records</strong>
                    </span>
                  ))}
                </div>
                {importPreview.periods.some((period) => dashboard?.periods.includes(period.periodKey)) && (
                  <div className="notice warning">
                    Previously uploaded months will be replaced safely. Months with identical records will be skipped.
                  </div>
                )}
                {importProgress && <div className="notice info">{importProgress}</div>}
              </div>
            )}

            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setUploadOpen(false)} disabled={busy}>Cancel</button>
              <button
                className="primary-button"
                onClick={importReport}
                disabled={!importPreview || busy || !supportsSafeBatchImport(backendVersion)}
              >
                {busy ? importProgress || "Importing…" : "Import & Update Dashboard"}
              </button>
            </div>
          </section>
        </div>
      )}

      {importsOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !busy && setImportsOpen(false)}>
          <section ref={importsDialogRef} className="modal-card imports-modal" role="dialog" aria-modal="true" aria-labelledby="imports-title" onMouseDown={(event) => event.stopPropagation()}>
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
          <section ref={importRecordsDialogRef} className="modal-card records-modal" role="dialog" aria-modal="true" aria-labelledby="import-records-title" onMouseDown={(event) => event.stopPropagation()}>
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
          <section ref={categoryRecordsDialogRef} className="modal-card records-modal" role="dialog" aria-modal="true" aria-labelledby="records-title" onMouseDown={(event) => event.stopPropagation()}>
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
              {categoryRecordsLoading && <div className="notice info">Loading completed records…</div>}
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
                  {!categoryRecordsLoading && !categoryRecords.length && (
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
