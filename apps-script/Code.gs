/**
 * TargetSolutions Dashboard backend
 * Martinsville Fire & EMS
 *
 * Paste this entire file into a Google Sheet-bound Apps Script project.
 * Run setupSystem once, then deploy as a Web App.
 */

const TARGET_DASHBOARD = {
  version: "1.2.0",
  timezone: "America/New_York",
  sessionSeconds: 21600,
  sheets: {
    settings: "Settings",
    users: "Users",
    completions: "Completions",
    imports: "Imports",
    categoryRules: "CategoryRules",
    monthlySummary: "MonthlySummary",
    auditLog: "AuditLog",
  },
};

const SOURCE_HEADERS = [
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
];

const COMPLETION_HEADERS = [
  "Import ID",
  "Period Key",
  "Category Key",
  "Documented Hours",
  "Imported At",
  "Imported By",
].concat(SOURCE_HEADERS);

const IMPORT_HEADERS = [
  "Import ID",
  "Period Key",
  "File Name",
  "Imported At",
  "Imported By",
  "Row Count",
  "Status",
  "Fingerprint",
];

const USER_HEADERS = [
  "Created At",
  "Display Name",
  "Username",
  "Password",
  "Role",
  "Active",
];

const RULE_HEADERS = [
  "Priority",
  "Category Key",
  "Category Label",
  "Field",
  "Match Type",
  "Pattern",
  "Active",
];

const SUMMARY_HEADERS = [
  "Period Key",
  "Year",
  "Category Key",
  "Category Label",
  "Completion Count",
  "Documented Hours",
];

const AUDIT_HEADERS = [
  "Timestamp",
  "Username",
  "Action",
  "Details",
];

const CATEGORY_DEFINITIONS = [
  ["apparatus_checks", "Apparatus Checks", "operations"],
  ["ems_weekly_checks", "EMS Weekly Checks", "operations"],
  ["scba_checks", "SCBA Checks", "operations"],
  ["training", "Training", "training"],
  ["pre_incident_planning", "Pre-incident Planning", "daily"],
  ["public_ed_in_station", "Public Ed In Station", "daily"],
  ["public_ed_off_site", "Public Ed Off Site", "daily"],
  ["smoke_detector", "Smoke Detector", "daily"],
  ["child_seats", "Child Seats", "daily"],
  ["other_activities", "Other Activities", "daily"],
  ["fire_inspection", "Fire Inspection", "fireMarshal"],
  ["building_inspection", "Building Inspection", "fireMarshal"],
  ["drone_flights", "Drone Flights", "fireMarshal"],
  ["fire_permits", "Fire Permits", "fireMarshal"],
  ["swat_activation", "SWAT Activation", "fireMarshal"],
  ["swat_training", "SWAT Training", "fireMarshal"],
  ["fire_investigations", "Fire Investigations", "fireMarshal"],
  ["uncategorized", "Uncategorized", "uncategorized"],
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Target Dashboard")
    .addItem("Setup / Repair System", "setupSystem")
    .addItem("Rebuild Monthly Summary", "rebuildMonthlySummary")
    .addToUi();
}

function setupSystem() {
  const result = setupSystem_(true);
  return result;
}

function rebuildMonthlySummary() {
  if (!isInitialized_()) {
    notifyUser_("Run Setup / Repair System first.");
    return;
  }
  rebuildMonthlySummary_();
  notifyUser_("Monthly summary rebuilt.");
}

function doGet() {
  return jsonResponse_({
    ok: true,
    service: "TargetSolutions Dashboard",
    version: TARGET_DASHBOARD.version,
    initialized: isInitialized_(),
  });
}

function doPost(event) {
  try {
    const payload = JSON.parse((event && event.postData && event.postData.contents) || "{}");
    const action = String(payload.action || "").trim();

    if (action === "status") {
      return jsonResponse_({
        ok: true,
        version: TARGET_DASHBOARD.version,
        initialized: isInitialized_(),
      });
    }

    if (action === "setup") {
      if (isInitialized_()) {
        const setupUser = requireSession_(payload.session);
        requireAdmin_(setupUser);
      }
      const setupResult = setupSystem_(false);
      return jsonResponse_({
        ok: true,
        initialized: true,
        createdDefaultAdmin: setupResult.createdDefaultAdmin,
      });
    }

    if (action === "login") {
      return jsonResponse_({
        ok: true,
        session: login_(payload.username, payload.password),
      });
    }

    if (action === "logout") {
      logout_(payload.session);
      return jsonResponse_({ ok: true });
    }

    const user = requireSession_(payload.session);

    if (action === "getDashboard") {
      return jsonResponse_({
        ok: true,
        dashboard: getDashboard_(payload.viewMode, payload.period, payload.includeRecords !== false),
      });
    }

    if (action === "importReport") {
      requireAdmin_(user);
      const importResult = importReportBatch_({
        fileName: payload.fileName,
        replaceExisting: payload.replaceExisting,
        periods: [{
          periodKey: payload.periodKey,
          records: payload.records,
        }],
      }, user);
      return jsonResponse_({
        ok: true,
        importedRows: importResult.importedRows,
        duplicateRowsSkipped: importResult.duplicateRowsSkipped,
        importedMonthCount: importResult.importedMonthCount,
        unchangedPeriods: importResult.unchangedPeriods,
        dashboard: getDashboard_("month", payload.periodKey, true),
      });
    }

    if (action === "importReportBatch") {
      requireAdmin_(user);
      const batchResult = importReportBatch_(payload, user);
      const latestPeriod = batchResult.latestPeriod || "";
      return jsonResponse_({
        ok: true,
        importedRows: batchResult.importedRows,
        duplicateRowsSkipped: batchResult.duplicateRowsSkipped,
        importedMonthCount: batchResult.importedMonthCount,
        unchangedPeriods: batchResult.unchangedPeriods,
        dashboard: getDashboard_("month", latestPeriod, false),
      });
    }

    if (action === "listImports") {
      requireAdmin_(user);
      return jsonResponse_({
        ok: true,
        imports: listImports_(),
      });
    }

    if (action === "getImportRecords") {
      requireAdmin_(user);
      return jsonResponse_({
        ok: true,
        records: getImportRecords_(payload.importId),
      });
    }

    if (action === "getCategoryRecords") {
      return jsonResponse_({
        ok: true,
        records: getCategoryRecords_(payload.viewMode, payload.period, payload.categoryKey),
      });
    }

    if (action === "deleteImport") {
      requireAdmin_(user);
      const deleteResult = deleteImport_(payload.importId, user);
      return jsonResponse_({
        ok: true,
        deletedRows: deleteResult.deletedRows,
        imports: listImports_(),
        dashboard: getDashboard_(payload.viewMode, payload.period, false),
      });
    }

    throw new Error("Unknown request.");
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: error && error.message ? error.message : String(error),
    });
  }
}

function setupSystem_(showAlert) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  spreadsheet.setSpreadsheetTimeZone(TARGET_DASHBOARD.timezone);

  ensureSheet_(TARGET_DASHBOARD.sheets.settings, ["Setting", "Value"]);
  ensureSheet_(TARGET_DASHBOARD.sheets.users, USER_HEADERS);
  ensureSheet_(TARGET_DASHBOARD.sheets.completions, COMPLETION_HEADERS);
  ensureSheet_(TARGET_DASHBOARD.sheets.imports, IMPORT_HEADERS);
  ensureSheet_(TARGET_DASHBOARD.sheets.categoryRules, RULE_HEADERS);
  ensureSheet_(TARGET_DASHBOARD.sheets.monthlySummary, SUMMARY_HEADERS);
  ensureSheet_(TARGET_DASHBOARD.sheets.auditLog, AUDIT_HEADERS);

  upsertSetting_("Version", TARGET_DASHBOARD.version);
  upsertSetting_("Timezone", TARGET_DASHBOARD.timezone);
  if (!getSetting_("Data Version")) upsertSetting_("Data Version", "1");

  const userSheet = spreadsheet.getSheetByName(TARGET_DASHBOARD.sheets.users);
  let createdDefaultAdmin = false;
  if (userSheet.getLastRow() < 2) {
    userSheet.appendRow([
      new Date(),
      "Administrator",
      "admin",
      "ChangeMe123!",
      "admin",
      true,
    ]);
    createdDefaultAdmin = true;
  }

  const ruleSheet = spreadsheet.getSheetByName(TARGET_DASHBOARD.sheets.categoryRules);
  if (ruleSheet.getLastRow() < 2) {
    const rules = defaultRules_();
    ruleSheet.getRange(2, 1, rules.length, RULE_HEADERS.length).setValues(rules);
  }

  formatSystemSheets_();
  repairPeriodKeys_();
  rebuildMonthlySummary_();
  SpreadsheetApp.flush();

  if (showAlert) {
    const note = createdDefaultAdmin
      ? "Setup complete.\n\nInitial login:\nUsername: admin\nPassword: ChangeMe123!\n\nChange the password on the Users tab before sharing the site."
      : "Setup/repair complete. Existing data and users were preserved.";
    notifyUser_(note);
  }

  return { createdDefaultAdmin: createdDefaultAdmin };
}

function ensureSheet_(name, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);

  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }

  const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  let needsHeaders = false;
  for (let index = 0; index < headers.length; index += 1) {
    if (currentHeaders[index] !== headers[index]) {
      needsHeaders = true;
      break;
    }
  }
  if (needsHeaders && sheet.getLastRow() >= 2) {
    throw new Error(
      name + " contains data but its header row does not match the dashboard. " +
      "Restore the expected headers before running Setup / Repair."
    );
  }
  if (needsHeaders) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}

function formatSystemSheets_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TARGET_DASHBOARD.sheets).forEach(function (key) {
    const sheet = spreadsheet.getSheetByName(TARGET_DASHBOARD.sheets[key]);
    if (!sheet) return;
    const lastColumn = Math.max(1, sheet.getLastColumn());
    sheet.getRange(1, 1, 1, lastColumn)
      .setBackground("#0b2f52")
      .setFontColor("#ffffff")
      .setFontWeight("bold");
    sheet.setFrozenRows(1);
  });

  const users = spreadsheet.getSheetByName(TARGET_DASHBOARD.sheets.users);
  users.setColumnWidths(1, USER_HEADERS.length, 135);
  users.setColumnWidth(2, 190);
  users.setColumnWidth(4, 170);

  const imports = spreadsheet.getSheetByName(TARGET_DASHBOARD.sheets.imports);
  imports.setColumnWidths(1, IMPORT_HEADERS.length, 145);
  imports.setColumnWidth(3, 280);
  imports.getRange(2, 2, Math.max(1, imports.getMaxRows() - 1), 1).setNumberFormat("@");

  const rules = spreadsheet.getSheetByName(TARGET_DASHBOARD.sheets.categoryRules);
  rules.setColumnWidths(1, RULE_HEADERS.length, 150);
  rules.setColumnWidth(3, 190);
  rules.setColumnWidth(6, 390);

  const completions = spreadsheet.getSheetByName(TARGET_DASHBOARD.sheets.completions);
  completions.setColumnWidths(1, Math.min(COMPLETION_HEADERS.length, 12), 130);
  completions.setColumnWidth(14, 310);
  completions.getRange(2, 2, Math.max(1, completions.getMaxRows() - 1), 1).setNumberFormat("@");
}

function defaultRules_() {
  return [
    [10, "pre_incident_planning", "Pre-incident Planning", "Assignment Name", "regex", "pre[\\s-]*incident", true],
    [11, "public_ed_in_station", "Public Ed In Station", "Assignment Name", "regex", "public.*education.*in[\\s-]*station", true],
    [12, "public_ed_off_site", "Public Ed Off Site", "Assignment Name", "regex", "public.*education.*off[\\s-]*site", true],
    [13, "smoke_detector", "Smoke Detector", "Assignment Name", "regex", "smoke detector", true],
    [14, "child_seats", "Child Seats", "Assignment Name", "regex", "child passenger safety|child seats?", true],
    [15, "other_activities", "Other Activities", "Assignment Name", "regex", "other activities", true],

    [20, "fire_inspection", "Fire Inspection", "Assignment Name", "regex", "^fire inspections?$", true],
    [21, "building_inspection", "Building Inspection", "Assignment Type", "regex", "^building inspections?$", true],
    [22, "drone_flights", "Drone Flights", "Assignment Name", "regex", "drone flights?", true],
    [23, "fire_permits", "Fire Permits", "Assignment Name", "regex", "fire permits?", true],
    [24, "swat_activation", "SWAT Activation", "Assignment Name", "regex", "swat.*activation", true],
    [25, "swat_training", "SWAT Training", "Assignment Name", "regex", "swat.*training", true],
    [26, "fire_investigations", "Fire Investigations", "Assignment Name", "regex", "fire investigations?", true],

    [30, "apparatus_checks", "Apparatus Checks", "Assignment Type", "exact", "Apparatus Checks", true],
    [31, "ems_weekly_checks", "EMS Weekly Checks", "Assignment Type", "exact", "EMS Weekly Checks", true],
    [32, "scba_checks", "SCBA Checks", "Assignment Type", "exact", "SCBA Checks", true],

    [50, "training", "Training", "Assignment Type", "regex", "^(MF-EMS Training|Fire Competencies Skills|TS Course|Company Training, NFPA 1001|Daily Activities, NFPA 1500|EMS Skill Assessment Form|New Employee Orientation|Driver/Operator Training, NFPA 1002)$", true],
    [51, "training", "Training", "Tags", "regex", "company training|officer training|facilit(?:y|ies) training|hazardous materials|training drills", true],
    [52, "training", "Training", "Assignment Name", "regex", "training|NFPA 1001|NFPA 1002|NFPA 470", true],
  ];
}

function login_(username, password) {
  if (!isInitialized_()) throw new Error("The database has not been set up.");
  const cleanUsername = String(username || "").trim().toLowerCase();
  const cleanPassword = String(password || "");
  if (!cleanUsername || !cleanPassword) throw new Error("Enter a username and password.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TARGET_DASHBOARD.sheets.users);
  const values = sheet.getDataRange().getValues();
  const headers = headerMap_(values[0]);

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const rowUsername = String(row[headers["Username"]] || "").trim().toLowerCase();
    const rowPassword = String(row[headers["Password"]] || "");
    const active = isTrue_(row[headers["Active"]]);
    if (rowUsername === cleanUsername && rowPassword === cleanPassword && active) {
      const session = {
        token: Utilities.getUuid() + Utilities.getUuid().replace(/-/g, ""),
        displayName: String(row[headers["Display Name"]] || row[headers["Username"]]),
        username: String(row[headers["Username"]]),
        role: String(row[headers["Role"]] || "viewer").toLowerCase(),
      };
      CacheService.getScriptCache().put(
        "session_" + session.token,
        JSON.stringify(session),
        TARGET_DASHBOARD.sessionSeconds
      );
      addAudit_(session.username, "Login", "Successful login");
      return session;
    }
  }
  throw new Error("The username or password is incorrect.");
}

function requireSession_(token) {
  const cleanToken = String(token || "");
  if (!cleanToken) throw new Error("Please sign in.");
  const cache = CacheService.getScriptCache();
  const stored = cache.get("session_" + cleanToken);
  if (!stored) throw new Error("Your session expired. Please sign in again.");
  cache.put("session_" + cleanToken, stored, TARGET_DASHBOARD.sessionSeconds);
  return JSON.parse(stored);
}

function requireAdmin_(user) {
  if (!user || String(user.role).toLowerCase() !== "admin") {
    throw new Error("Administrator access is required.");
  }
}

function logout_(token) {
  if (token) CacheService.getScriptCache().remove("session_" + String(token));
}

function importReportBatch_(payload, user) {
  if (!Array.isArray(payload.periods) || !payload.periods.length) {
    throw new Error("The uploaded report does not contain any reporting months.");
  }

  const requestedPeriods = [];
  const seenPeriods = {};
  payload.periods.forEach(function (periodPayload) {
    const periodKey = strictPeriodKey_(periodPayload && periodPayload.periodKey);
    if (!periodKey) throw new Error("The report contains an invalid reporting month.");
    if (seenPeriods[periodKey]) throw new Error("The report contains the same reporting month more than once.");
    if (!Array.isArray(periodPayload.records) || !periodPayload.records.length) {
      throw new Error(dashboardPeriodLabel_("month", periodKey) + " does not contain any completion records.");
    }
    seenPeriods[periodKey] = true;
    requestedPeriods.push({
      periodKey: periodKey,
      records: periodPayload.records,
    });
  });

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error("Another import is running. Try again in a moment.");

  try {
    requireHealthySystem_();
    repairPeriodKeys_();

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const completionSheet = spreadsheet.getSheetByName(TARGET_DASHBOARD.sheets.completions);
    const importSheet = spreadsheet.getSheetByName(TARGET_DASHBOARD.sheets.imports);
    const completionValues = completionSheet.getDataRange().getValues();
    const importValues = importSheet.getDataRange().getValues();
    const completionHeaders = headerMap_(completionValues[0] || COMPLETION_HEADERS);
    const importHeaders = headerMap_(importValues[0] || IMPORT_HEADERS);
    const periodColumn = completionHeaders["Period Key"];
    const rules = loadRules_();
    const importedAt = new Date();
    const fileName = String(payload.fileName || "TargetSolutions report.csv");
    const replaceExisting = payload.replaceExisting !== false;
    let duplicateRowsSkipped = 0;
    const unchangedPeriods = [];
    const preparedPeriods = [];
    const incomingKeysAcrossBatch = {};

    requestedPeriods.forEach(function (periodPayload) {
      const periodKey = periodPayload.periodKey;
      const periodLabel = dashboardPeriodLabel_("month", periodKey);
      const importId = Utilities.getUuid();
      const fingerprint = fingerprintRecords_(periodPayload.records);
      const seenIncomingKeys = {};
      let output = [];

      periodPayload.records.forEach(function (record, index) {
        const recordPeriod = completionDatePeriodKey_(record["Completion Date"]);
        if (!recordPeriod) {
          throw new Error(periodLabel + ": row " + (index + 1) + " has an invalid completion date.");
        }
        if (recordPeriod !== periodKey) {
          throw new Error(
            periodLabel + ": row " + (index + 1) + " belongs to " +
            dashboardPeriodLabel_("month", recordPeriod) + "."
          );
        }

        const completionKey = completionKeyFromRecord_(record);
        if (seenIncomingKeys[completionKey] || incomingKeysAcrossBatch[completionKey]) {
          duplicateRowsSkipped += 1;
          return;
        }
        seenIncomingKeys[completionKey] = true;
        incomingKeysAcrossBatch[completionKey] = true;

        const categoryKey = classifyRecord_(record, rules);
        const documentedHours = documentedHours_(record);
        const row = [
          importId,
          periodKey,
          categoryKey,
          documentedHours === null ? "" : documentedHours,
          importedAt,
          user.username,
        ];
        SOURCE_HEADERS.forEach(function (header) {
          row.push(record[header] === undefined || record[header] === null ? "" : String(record[header]));
        });
        output.push(row);
      });

      if (!output.length) throw new Error(periodLabel + " does not contain any unique completion records.");

      const existingPeriodRows = completionValues.slice(1).filter(function (row) {
        return normalizePeriodKey_(row[periodColumn]) === periodKey;
      });
      const existingKeys = {};
      existingPeriodRows.forEach(function (row) {
        existingKeys[completionKeyFromStoredRow_(row, completionHeaders)] = true;
      });
      const incomingKeyList = Object.keys(seenIncomingKeys).sort();
      const existingKeyList = Object.keys(existingKeys).sort();
      const sameCompletions =
        incomingKeyList.length === existingKeyList.length &&
        incomingKeyList.every(function (key, index) { return key === existingKeyList[index]; });

      const fingerprintExists = importValues.slice(1).some(function (row) {
        const status = String(row[importHeaders["Status"]] || "").toLowerCase();
        return status !== "deleted" &&
          fingerprint &&
          String(row[importHeaders["Fingerprint"]] || "") === fingerprint;
      });
      if (fingerprintExists || sameCompletions) {
        unchangedPeriods.push(periodLabel);
        return;
      }

      if (existingPeriodRows.length && !replaceExisting) {
        throw new Error(periodLabel + " was already imported.");
      }

      preparedPeriods.push({
        periodKey: periodKey,
        periodLabel: periodLabel,
        importId: importId,
        fingerprint: fingerprint,
        output: output,
        replacesExisting: existingPeriodRows.length > 0,
      });
    });

    if (!preparedPeriods.length) {
      return {
        importedRows: 0,
        duplicateRowsSkipped: duplicateRowsSkipped,
        importedMonthCount: 0,
        unchangedPeriods: unchangedPeriods,
        latestPeriod: requestedPeriods[requestedPeriods.length - 1].periodKey,
      };
    }

    const replacementPeriods = {};
    preparedPeriods.forEach(function (period) {
      replacementPeriods[period.periodKey] = true;
    });

    const retainedRows = completionValues.slice(1).filter(function (row) {
      return !replacementPeriods[normalizePeriodKey_(row[periodColumn])];
    }).map(function (row) {
      const normalized = row.slice(0, COMPLETION_HEADERS.length);
      while (normalized.length < COMPLETION_HEADERS.length) normalized.push("");
      normalized[periodColumn] = normalizePeriodKey_(normalized[periodColumn]);
      return normalized;
    });
    const retainedKeys = {};
    retainedRows.forEach(function (row) {
      retainedKeys[completionKeyFromStoredRow_(row, completionHeaders)] = true;
    });

    let importedRows = 0;
    const finalPreparedPeriods = preparedPeriods.map(function (period) {
      const uniqueOutput = period.output.filter(function (row) {
        const key = completionKeyFromStoredRow_(row, headerMap_(COMPLETION_HEADERS));
        if (retainedKeys[key]) {
          duplicateRowsSkipped += 1;
          return false;
        }
        retainedKeys[key] = true;
        return true;
      });
      if (!uniqueOutput.length) {
        throw new Error(period.periodLabel + ": every completion is already stored in another reporting month.");
      }
      importedRows += uniqueOutput.length;
      period.output = uniqueOutput;
      return period;
    });

    const nextCompletionRows = retainedRows.slice();
    finalPreparedPeriods.forEach(function (period) {
      nextCompletionRows = nextCompletionRows.concat(period.output);
    });

    const nextImportRows = importValues.slice(1).map(function (row) {
      const normalized = row.slice(0, IMPORT_HEADERS.length);
      while (normalized.length < IMPORT_HEADERS.length) normalized.push("");
      const periodKey = normalizePeriodKey_(normalized[importHeaders["Period Key"]]);
      const status = String(normalized[importHeaders["Status"]] || "");
      if (replacementPeriods[periodKey] && status.toLowerCase() !== "deleted") {
        normalized[importHeaders["Status"]] = "Replaced";
      }
      normalized[importHeaders["Period Key"]] = periodKey;
      return normalized;
    });
    finalPreparedPeriods.forEach(function (period) {
      nextImportRows.push([
        period.importId,
        period.periodKey,
        fileName,
        importedAt,
        user.username,
        period.output.length,
        "Active",
        period.fingerprint,
      ]);
    });

    replaceImportDataSafely_(nextCompletionRows, nextImportRows);
    try {
      incrementDataVersion_();
      addAudit_(
        user.username,
        finalPreparedPeriods.some(function (period) { return period.replacesExisting; })
          ? "Import or replace report batch"
          : "Import report batch",
        finalPreparedPeriods.map(function (period) {
          return period.periodKey + " · " + period.output.length + " records";
        }).join("; ") + " · " + fileName
      );
      SpreadsheetApp.flush();
    } catch (metadataError) {
      console.error("Import metadata update failed: " + String(metadataError));
    }

    return {
      importedRows: importedRows,
      duplicateRowsSkipped: duplicateRowsSkipped,
      importedMonthCount: finalPreparedPeriods.length,
      unchangedPeriods: unchangedPeriods,
      latestPeriod: requestedPeriods[requestedPeriods.length - 1].periodKey,
    };
  } finally {
    lock.releaseLock();
  }
}

function replaceImportDataSafely_(completionRows, importRows) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const completionSheet = spreadsheet.getSheetByName(TARGET_DASHBOARD.sheets.completions);
  const importSheet = spreadsheet.getSheetByName(TARGET_DASHBOARD.sheets.imports);
  const backupSuffix = String(new Date().getTime()) + "_" + Utilities.getUuid().slice(0, 8);
  let completionBackup = null;
  let importBackup = null;
  try {
    completionBackup = completionSheet.copyTo(spreadsheet)
      .setName("_Backup_Completions_" + backupSuffix);
    importBackup = importSheet.copyTo(spreadsheet)
      .setName("_Backup_Imports_" + backupSuffix);
    completionBackup.hideSheet();
    importBackup.hideSheet();
  } catch (backupError) {
    deleteBackupSheets_(spreadsheet, [completionBackup, importBackup]);
    throw new Error("A safety backup could not be created, so the report was not changed.");
  }

  try {
    writeSheetRows_(completionSheet, COMPLETION_HEADERS, completionRows);
    writeSheetRows_(importSheet, IMPORT_HEADERS, importRows);
    rebuildMonthlySummary_();
    SpreadsheetApp.flush();
  } catch (error) {
    let restored = false;
    try {
      writeSheetRows_(
        completionSheet,
        COMPLETION_HEADERS,
        completionBackup.getDataRange().getValues().slice(1)
      );
      writeSheetRows_(
        importSheet,
        IMPORT_HEADERS,
        importBackup.getDataRange().getValues().slice(1)
      );
      rebuildMonthlySummary_();
      SpreadsheetApp.flush();
      restored = true;
    } catch (restoreError) {
      console.error("Automatic import rollback failed: " + String(restoreError));
    }

    if (restored) {
      deleteBackupSheets_(spreadsheet, [completionBackup, importBackup]);
      throw new Error("The import was not saved. Your existing completion data was restored.");
    }
    throw new Error(
      "The import could not be completed. Backup tabs were preserved in the spreadsheet for recovery."
    );
  }
  deleteBackupSheets_(spreadsheet, [completionBackup, importBackup]);
}

function deleteBackupSheets_(spreadsheet, backupSheets) {
  backupSheets.forEach(function (backupSheet) {
    if (!backupSheet) return;
    try {
      spreadsheet.deleteSheet(backupSheet);
    } catch (cleanupError) {
      console.error("Backup cleanup failed: " + String(cleanupError));
    }
  });
}

function writeSheetRows_(sheet, headers, rows) {
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  const requiredRows = Math.max(2, rows.length + 1);
  if (sheet.getMaxRows() < requiredRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
  }

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows.length) {
    const normalizedRows = rows.map(function (row) {
      const normalized = row.slice(0, headers.length);
      while (normalized.length < headers.length) normalized.push("");
      return normalized;
    });
    sheet.getRange(2, 1, normalizedRows.length, headers.length).setValues(normalizedRows);
  }
  const periodColumn = headers.indexOf("Period Key");
  if (periodColumn >= 0) {
    sheet.getRange(2, periodColumn + 1, Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat("@");
  }
  sheet.setFrozenRows(1);
}

function listImports_() {
  repairPeriodKeys_();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const importSheet = spreadsheet.getSheetByName(TARGET_DASHBOARD.sheets.imports);
  if (!importSheet || importSheet.getLastRow() < 2) return [];

  const importValues = importSheet.getDataRange().getValues();
  const headers = headerMap_(importValues[0] || IMPORT_HEADERS);
  const activeCounts = activeImportRecordCounts_();

  return importValues.slice(1).map(function (row) {
    const importId = String(row[headers["Import ID"]] || "");
    const periodKey = normalizePeriodKey_(row[headers["Period Key"]]);
    const storedStatus = String(row[headers["Status"]] || "Imported");
    const activeRecordCount = activeCounts[importId] || 0;
    return {
      importId: importId,
      periodKey: periodKey,
      periodLabel: dashboardPeriodLabel_("month", periodKey),
      fileName: String(row[headers["File Name"]] || ""),
      importedAt: formatTimestamp_(row[headers["Imported At"]]),
      importedBy: String(row[headers["Imported By"]] || ""),
      rowCount: Number(row[headers["Row Count"]]) || 0,
      activeRecordCount: activeRecordCount,
      status: storedStatus.toLowerCase() === "deleted"
        ? "Deleted"
        : activeRecordCount > 0
          ? "Active"
          : storedStatus,
    };
  }).filter(function (item) {
    return Boolean(item.importId);
  }).reverse();
}

function getImportRecords_(importId) {
  const cleanImportId = String(importId || "").trim();
  if (!cleanImportId) throw new Error("Choose an uploaded report to view.");

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const importSheet = spreadsheet.getSheetByName(TARGET_DASHBOARD.sheets.imports);
  const importValues = importSheet.getDataRange().getValues();
  const importHeaders = headerMap_(importValues[0] || IMPORT_HEADERS);
  const importExists = importValues.slice(1).some(function (row) {
    return String(row[importHeaders["Import ID"]] || "") === cleanImportId;
  });
  if (!importExists) throw new Error("That uploaded report could not be found.");

  const completionSheet = spreadsheet.getSheetByName(TARGET_DASHBOARD.sheets.completions);
  const completionValues = completionSheet.getDataRange().getValues();
  const headers = headerMap_(completionValues[0] || COMPLETION_HEADERS);
  return completionValues.slice(1).filter(function (row) {
    return String(row[headers["Import ID"]] || "") === cleanImportId;
  }).map(function (row) {
    return dashboardRecordFromRow_(row, headers);
  });
}

function deleteImport_(importId, user) {
  const cleanImportId = String(importId || "").trim();
  if (!cleanImportId) throw new Error("Choose an uploaded report to delete.");

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error("Another report change is running. Try again in a moment.");

  try {
    requireHealthySystem_();
    repairPeriodKeys_();
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const importSheet = spreadsheet.getSheetByName(TARGET_DASHBOARD.sheets.imports);
    const importValues = importSheet.getDataRange().getValues();
    const importHeaders = headerMap_(importValues[0] || IMPORT_HEADERS);
    let importRowIndex = -1;
    let fileName = "";
    let periodKey = "";
    for (let index = 1; index < importValues.length; index += 1) {
      if (String(importValues[index][importHeaders["Import ID"]] || "") === cleanImportId) {
        importRowIndex = index + 1;
        fileName = String(importValues[index][importHeaders["File Name"]] || "");
        periodKey = normalizePeriodKey_(importValues[index][importHeaders["Period Key"]]);
        break;
      }
    }
    if (importRowIndex < 0) throw new Error("That uploaded report could not be found.");

    const statusColumn = importHeaders["Status"];
    const currentStatus = String(importValues[importRowIndex - 1][statusColumn] || "");
    if (currentStatus.toLowerCase() === "deleted") {
      throw new Error("That uploaded report was already deleted.");
    }

    const completionSheet = spreadsheet.getSheetByName(TARGET_DASHBOARD.sheets.completions);
    const completionValues = completionSheet.getDataRange().getValues();
    const completionHeaders = headerMap_(completionValues[0] || COMPLETION_HEADERS);
    const completionImportColumn = completionHeaders["Import ID"];
    const periodColumn = completionHeaders["Period Key"];
    let deletedRows = 0;
    const retained = completionValues.slice(1).filter(function (row) {
      const shouldDelete = String(row[completionImportColumn] || "") === cleanImportId;
      if (shouldDelete) deletedRows += 1;
      return !shouldDelete;
    }).map(function (row) {
      row[periodColumn] = normalizePeriodKey_(row[periodColumn]);
      return row;
    });

    const nextImportRows = importValues.slice(1).map(function (row, index) {
      const normalized = row.slice(0, IMPORT_HEADERS.length);
      while (normalized.length < IMPORT_HEADERS.length) normalized.push("");
      normalized[importHeaders["Period Key"]] = normalizePeriodKey_(normalized[importHeaders["Period Key"]]);
      if (index + 2 === importRowIndex) normalized[statusColumn] = "Deleted";
      return normalized;
    });

    replaceImportDataSafely_(retained, nextImportRows);
    try {
      incrementDataVersion_();
      addAudit_(
        user.username,
        "Delete uploaded report",
        periodKey + " · " + deletedRows + " records · " + fileName
      );
      SpreadsheetApp.flush();
    } catch (metadataError) {
      console.error("Delete metadata update failed: " + String(metadataError));
    }
    return { deletedRows: deletedRows };
  } finally {
    lock.releaseLock();
  }
}

function loadRules_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TARGET_DASHBOARD.sheets.categoryRules);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = headerMap_(values[0]);
  return values.slice(1)
    .filter(function (row) {
      return isTrue_(row[headers["Active"]]);
    })
    .map(function (row) {
      return {
        priority: Number(row[headers["Priority"]]) || 999,
        categoryKey: String(row[headers["Category Key"]] || ""),
        field: String(row[headers["Field"]] || ""),
        matchType: String(row[headers["Match Type"]] || "contains").toLowerCase(),
        pattern: String(row[headers["Pattern"]] || ""),
      };
    })
    .sort(function (left, right) {
      return left.priority - right.priority;
    });
}

function classifyRecord_(record, rules) {
  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    const value = String(record[rule.field] || "");
    if (!value || !rule.pattern) continue;

    if (rule.matchType === "exact" && value.toLowerCase() === rule.pattern.toLowerCase()) {
      return rule.categoryKey;
    }
    if (rule.matchType === "contains" && value.toLowerCase().indexOf(rule.pattern.toLowerCase()) !== -1) {
      return rule.categoryKey;
    }
    if (rule.matchType === "regex") {
      try {
        if (new RegExp(rule.pattern, "i").test(value)) return rule.categoryKey;
      } catch (error) {
        // Invalid custom rules are skipped so imports can continue.
      }
    }
  }
  return "uncategorized";
}

function documentedHours_(record) {
  const duration = parseFloat(String(record["Duration (hours)"] || "").replace(",", "."));
  if (isFinite(duration) && duration > 0) return Math.round(duration * 100) / 100;

  const courseTime = String(record["Time Spent In Course"] || "").trim();
  if (!courseTime) return null;
  if (/^\d+(\.\d+)?$/.test(courseTime)) {
    const numeric = Number(courseTime);
    return numeric > 0 ? Math.round(numeric * 100) / 100 : null;
  }

  const parts = courseTime.split(":").map(Number);
  if (parts.length === 2 && parts.every(isFinite)) {
    return Math.round((parts[0] + parts[1] / 60) * 100) / 100;
  }
  if (parts.length === 3 && parts.every(isFinite)) {
    return Math.round((parts[0] + parts[1] / 60 + parts[2] / 3600) * 100) / 100;
  }
  return null;
}

function completionKeyFromRecord_(record) {
  const transcriptId = canonicalValue_(record["Transcript ID"]);
  if (transcriptId) return "transcript|" + transcriptId;
  return [
    "fallback",
    canonicalValue_(record["Employee ID"] || record["TS UserID"]),
    canonicalValue_(record["Assignment Name"]),
    canonicalValue_(record["Completion Date"]),
    canonicalValue_(record["Completion Time"]),
    canonicalValue_(record["Course ID"]),
  ].join("|");
}

function completionKeyFromStoredRow_(row, headers) {
  const transcriptId = canonicalValue_(row[headers["Transcript ID"]]);
  if (transcriptId) return "transcript|" + transcriptId;
  return [
    "fallback",
    canonicalValue_(row[headers["Employee ID"]] || row[headers["TS UserID"]]),
    canonicalValue_(row[headers["Assignment Name"]]),
    formatSheetDate_(row[headers["Completion Date"]]),
    canonicalValue_(row[headers["Completion Time"]]),
    canonicalValue_(row[headers["Course ID"]]),
  ].join("|");
}

function canonicalValue_(value) {
  return String(value === undefined || value === null ? "" : value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function fingerprintRecords_(records) {
  const keys = {};
  records.forEach(function (record) {
    keys[completionKeyFromRecord_(record)] = true;
  });
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Object.keys(keys).sort().join("\n"),
    Utilities.Charset.UTF_8
  );
  return digest.map(function (byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ("0" + value.toString(16)).slice(-2);
  }).join("");
}

function activeImportRecordCounts_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TARGET_DASHBOARD.sheets.completions);
  if (!sheet || sheet.getLastRow() < 2) return {};
  const values = sheet.getDataRange().getValues();
  const headers = headerMap_(values[0] || COMPLETION_HEADERS);
  const counts = {};
  values.slice(1).forEach(function (row) {
    const importId = String(row[headers["Import ID"]] || "");
    if (importId) counts[importId] = (counts[importId] || 0) + 1;
  });
  return counts;
}

function getDashboard_(viewMode, requestedPeriod, includeRecords) {
  const mode = ["month", "year", "all"].indexOf(String(viewMode)) !== -1 ? String(viewMode) : "month";
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TARGET_DASHBOARD.sheets.completions);
  const values = sheet.getDataRange().getValues();
  const headers = headerMap_(values[0] || COMPLETION_HEADERS);
  const seenCompletionKeys = {};
  const allRows = values.slice(1).filter(function (row) {
    return row.some(function (cell) { return cell !== ""; });
  }).filter(function (row) {
    const key = completionKeyFromStoredRow_(row, headers);
    if (seenCompletionKeys[key]) return false;
    seenCompletionKeys[key] = true;
    return true;
  });

  const periods = uniqueSorted_(allRows.map(function (row) {
    return normalizePeriodKey_(row[headers["Period Key"]]);
  }).filter(Boolean), true);
  const years = uniqueSorted_(periods.map(function (period) {
    return period.slice(0, 4);
  }), true);

  let selectedPeriod = String(requestedPeriod || "");
  if (mode === "month" && periods.indexOf(selectedPeriod) === -1) selectedPeriod = periods[0] || "";
  if (mode === "year" && years.indexOf(selectedPeriod) === -1) selectedPeriod = years[0] || "";
  if (mode === "all") selectedPeriod = "all";

  const rows = allRows.filter(function (row) {
    const period = normalizePeriodKey_(row[headers["Period Key"]]);
    if (mode === "month") return period === selectedPeriod;
    if (mode === "year") return period.slice(0, 4) === selectedPeriod;
    return true;
  });

  const categoryMap = {};
  CATEGORY_DEFINITIONS.forEach(function (definition) {
    categoryMap[definition[0]] = {
      key: definition[0],
      label: definition[1],
      section: definition[2],
      count: 0,
      hours: 0,
    };
  });

  const employees = {};
  let totalHours = 0;
  let hoursRecords = 0;
  const records = [];

  rows.forEach(function (row) {
    const categoryKey = String(row[headers["Category Key"]] || "uncategorized");
    const category = categoryMap[categoryKey] || categoryMap.uncategorized;
    const hours = Number(row[headers["Documented Hours"]]);
    const hasHours = isFinite(hours) && hours > 0;
    category.count += 1;
    if (hasHours) {
      category.hours += hours;
      totalHours += hours;
      hoursRecords += 1;
    }

    const employeeId = String(row[headers["Employee ID"]] || "");
    const firstName = String(row[headers["First Name"]] || "");
    const lastName = String(row[headers["Last Name"]] || "");
    employees[employeeId || firstName + "|" + lastName] = true;

    if (includeRecords !== false) records.push(dashboardRecordFromRow_(row, headers));
  });

  const categories = CATEGORY_DEFINITIONS.map(function (definition) {
    const category = categoryMap[definition[0]];
    category.hours = Math.round(category.hours * 100) / 100;
    return category;
  });

  function sectionCount(section) {
    return categories
      .filter(function (category) { return category.section === section; })
      .reduce(function (sum, category) { return sum + category.count; }, 0);
  }

  return {
    selectedPeriod: selectedPeriod,
    periodLabel: dashboardPeriodLabel_(mode, selectedPeriod),
    viewMode: mode,
    periods: periods,
    years: years,
    totals: {
      completions: rows.length,
      employees: Object.keys(employees).length,
      hours: Math.round(totalHours * 100) / 100,
      hoursRecords: hoursRecords,
      missingHours: rows.length - hoursRecords,
      training: categoryMap.training.count,
    },
    sections: {
      operations: sectionCount("operations"),
      daily: sectionCount("daily"),
      fireMarshal: sectionCount("fireMarshal"),
      uncategorized: categoryMap.uncategorized.count,
    },
    categories: categories,
    records: records,
    lastImport: getLastImport_(),
  };
}

function getCategoryRecords_(viewMode, requestedPeriod, categoryKey) {
  const validCategory = CATEGORY_DEFINITIONS.some(function (definition) {
    return definition[0] === String(categoryKey || "");
  });
  if (!validCategory) throw new Error("Choose a valid dashboard category.");

  const mode = ["month", "year", "all"].indexOf(String(viewMode)) !== -1 ? String(viewMode) : "month";
  const selectedPeriod = mode === "all" ? "all" : String(requestedPeriod || "");
  if (mode === "month" && !strictPeriodKey_(selectedPeriod)) {
    throw new Error("Choose a valid reporting month.");
  }
  if (mode === "year" && !/^\d{4}$/.test(selectedPeriod)) {
    throw new Error("Choose a valid reporting year.");
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TARGET_DASHBOARD.sheets.completions);
  const values = sheet.getDataRange().getValues();
  const headers = headerMap_(values[0] || COMPLETION_HEADERS);
  const seenCompletionKeys = {};
  return values.slice(1).filter(function (row) {
    const key = completionKeyFromStoredRow_(row, headers);
    if (seenCompletionKeys[key]) return false;
    seenCompletionKeys[key] = true;

    if (String(row[headers["Category Key"]] || "uncategorized") !== String(categoryKey)) return false;
    const period = normalizePeriodKey_(row[headers["Period Key"]]);
    if (mode === "month") return period === selectedPeriod;
    if (mode === "year") return period.slice(0, 4) === selectedPeriod;
    return true;
  }).map(function (row) {
    return dashboardRecordFromRow_(row, headers);
  });
}

function dashboardRecordFromRow_(row, headers) {
  const hours = Number(row[headers["Documented Hours"]]);
  return {
    categoryKey: String(row[headers["Category Key"]] || "uncategorized"),
    firstName: String(row[headers["First Name"]] || ""),
    lastName: String(row[headers["Last Name"]] || ""),
    employeeId: String(row[headers["Employee ID"]] || ""),
    shift: String(row[headers["Shift"]] || ""),
    rank: String(row[headers["Rank"]] || ""),
    assignmentName: String(row[headers["Assignment Name"]] || ""),
    assignmentType: String(row[headers["Assignment Type"]] || ""),
    completionDate: formatSheetDate_(row[headers["Completion Date"]]),
    completionTime: String(row[headers["Completion Time"]] || ""),
    documentedHours: isFinite(hours) && hours > 0 ? Math.round(hours * 100) / 100 : 0,
    instructor: String(row[headers["Instructor"]] || row[headers["Event Instructor"]] || ""),
    location: String(row[headers["Location"]] || row[headers["Event Location"]] || ""),
  };
}

function rebuildMonthlySummary_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const completionSheet = spreadsheet.getSheetByName(TARGET_DASHBOARD.sheets.completions);
  const summarySheet = ensureSheet_(TARGET_DASHBOARD.sheets.monthlySummary, SUMMARY_HEADERS);
  const values = completionSheet.getDataRange().getValues();
  const headers = headerMap_(values[0] || COMPLETION_HEADERS);
  const summary = {};
  const labels = {};
  CATEGORY_DEFINITIONS.forEach(function (definition) {
    labels[definition[0]] = definition[1];
  });

  const seenCompletionKeys = {};
  values.slice(1).forEach(function (row) {
    const completionKey = completionKeyFromStoredRow_(row, headers);
    if (seenCompletionKeys[completionKey]) return;
    seenCompletionKeys[completionKey] = true;
    const period = normalizePeriodKey_(row[headers["Period Key"]]);
    const categoryKey = String(row[headers["Category Key"]] || "uncategorized");
    if (!period) return;
    const key = period + "|" + categoryKey;
    if (!summary[key]) summary[key] = { period: period, categoryKey: categoryKey, count: 0, hours: 0 };
    summary[key].count += 1;
    const hours = Number(row[headers["Documented Hours"]]);
    if (isFinite(hours) && hours > 0) summary[key].hours += hours;
  });

  const output = Object.keys(summary).sort().map(function (key) {
    const item = summary[key];
    return [
      item.period,
      item.period.slice(0, 4),
      item.categoryKey,
      labels[item.categoryKey] || "Uncategorized",
      item.count,
      Math.round(item.hours * 100) / 100,
    ];
  });

  summarySheet.clearContents();
  summarySheet.getRange(1, 1, 1, SUMMARY_HEADERS.length).setValues([SUMMARY_HEADERS]);
  if (output.length) summarySheet.getRange(2, 1, output.length, SUMMARY_HEADERS.length).setValues(output);
}

function getLastImport_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TARGET_DASHBOARD.sheets.imports);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const values = sheet.getDataRange().getValues();
  const headers = headerMap_(values[0]);
  const activeCounts = activeImportRecordCounts_();
  for (let index = values.length - 1; index >= 1; index -= 1) {
    const row = values[index];
    const importId = String(row[headers["Import ID"]] || "");
    const status = String(row[headers["Status"]] || "").toLowerCase();
    if (status === "deleted" || !activeCounts[importId]) continue;
    return {
      fileName: String(row[headers["File Name"]] || ""),
      periodKey: normalizePeriodKey_(row[headers["Period Key"]]),
      importedAt: formatTimestamp_(row[headers["Imported At"]]),
      rowCount: activeCounts[importId] || Number(row[headers["Row Count"]]) || 0,
    };
  }
  return null;
}

function addAudit_(username, action, details) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TARGET_DASHBOARD.sheets.auditLog);
  if (!sheet) return;
  sheet.appendRow([new Date(), username || "", action || "", details || ""]);
}

function getSetting_(key) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TARGET_DASHBOARD.sheets.settings);
  if (!sheet || sheet.getLastRow() < 2) return "";
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][0]) === String(key)) return String(values[index][1] || "");
  }
  return "";
}

function upsertSetting_(key, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TARGET_DASHBOARD.sheets.settings);
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (let index = 0; index < values.length; index += 1) {
      if (String(values[index][0]) === String(key)) {
        sheet.getRange(index + 2, 2).setValue(value);
        return;
      }
    }
  }
  sheet.appendRow([key, value]);
}

function incrementDataVersion_() {
  const current = Number(getSetting_("Data Version")) || 0;
  upsertSetting_("Data Version", String(current + 1));
}

function requiredSheetDefinitions_() {
  return [
    [TARGET_DASHBOARD.sheets.settings, ["Setting", "Value"]],
    [TARGET_DASHBOARD.sheets.users, USER_HEADERS],
    [TARGET_DASHBOARD.sheets.completions, COMPLETION_HEADERS],
    [TARGET_DASHBOARD.sheets.imports, IMPORT_HEADERS],
    [TARGET_DASHBOARD.sheets.categoryRules, RULE_HEADERS],
    [TARGET_DASHBOARD.sheets.monthlySummary, SUMMARY_HEADERS],
    [TARGET_DASHBOARD.sheets.auditLog, AUDIT_HEADERS],
  ];
}

function isInitialized_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  return requiredSheetDefinitions_().every(function (definition) {
    const sheet = spreadsheet.getSheetByName(definition[0]);
    if (!sheet || sheet.getLastColumn() < definition[1].length) return false;
    const currentHeaders = sheet.getRange(1, 1, 1, definition[1].length).getValues()[0];
    return definition[1].every(function (header, index) {
      return currentHeaders[index] === header;
    });
  });
}

function requireHealthySystem_() {
  if (!isInitialized_()) {
    throw new Error("The Google Sheet needs Setup / Repair before reports can be changed.");
  }
}

function headerMap_(headers) {
  const map = {};
  headers.forEach(function (header, index) {
    map[String(header)] = index;
  });
  return map;
}

function isTrue_(value) {
  return value === true || String(value).toLowerCase() === "true" || String(value) === "1";
}

function uniqueSorted_(values, descending) {
  const seen = {};
  values.forEach(function (value) {
    seen[String(value)] = true;
  });
  return Object.keys(seen).sort(function (left, right) {
    return descending ? right.localeCompare(left) : left.localeCompare(right);
  });
}

function strictPeriodKey_(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  return match ? match[1] + "-" + match[2] : "";
}

function completionDatePeriodKey_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, TARGET_DASHBOARD.timezone, "yyyy-MM");
  }

  const match = String(value || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "";
  }
  return String(year) + "-" + ("0" + month).slice(-2);
}

function normalizePeriodKey_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, TARGET_DASHBOARD.timezone, "yyyy-MM");
  }

  const text = String(value || "").trim();
  const strict = strictPeriodKey_(text);
  if (strict) return strict;

  const direct = text.match(/^(\d{4})-(\d{1,2})$/);
  if (direct) {
    const month = Number(direct[2]);
    if (month >= 1 && month <= 12) return direct[1] + "-" + ("0" + month).slice(-2);
  }

  return completionDatePeriodKey_(text);
}

function repairPeriodKeys_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  [TARGET_DASHBOARD.sheets.completions, TARGET_DASHBOARD.sheets.imports].forEach(function (sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return;
    const headerValues = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const headers = headerMap_(headerValues);
    const periodColumn = headers["Period Key"];
    if (periodColumn === undefined) return;
    const range = sheet.getRange(2, periodColumn + 1, sheet.getLastRow() - 1, 1);
    const repaired = range.getValues().map(function (row) {
      return [normalizePeriodKey_(row[0])];
    });
    range.setNumberFormat("@");
    range.setValues(repaired);
  });
}

function dashboardPeriodLabel_(mode, period) {
  if (mode === "all") return "All Time";
  if (mode === "year") return period || "No Data";
  const normalizedPeriod = normalizePeriodKey_(period);
  if (!normalizedPeriod) return "No Reports Uploaded";
  const parts = normalizedPeriod.split("-");
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  return Utilities.formatDate(date, TARGET_DASHBOARD.timezone, "MMMM yyyy");
}

function formatSheetDate_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, TARGET_DASHBOARD.timezone, "MM/dd/yyyy");
  }
  return String(value || "");
}

function formatTimestamp_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, TARGET_DASHBOARD.timezone, "MMM d, yyyy h:mm a");
  }
  return String(value || "");
}

function notifyUser_(message) {
  try {
    SpreadsheetApp.getUi().alert(String(message || ""));
  } catch (error) {
    console.log(String(message || ""));
  }
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
