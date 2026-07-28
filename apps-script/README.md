# Google Apps Script setup

1. Create a new Google Sheet for the dashboard.
2. Open **Extensions → Apps Script**.
3. Delete the starter function from `Code.gs`.
4. Copy the complete contents of `Code.gs` from this folder and paste it into the Apps Script editor.
5. Save the project.
6. Run `setupSystem` once and approve the requested Google permissions.
7. Return to the Google Sheet and refresh it. A **Target Dashboard** menu will appear.
8. Open the `Users` tab and change the default `admin` password before sharing the website.
9. In Apps Script, select **Deploy → New deployment → Web app**.
10. Choose:
    - Execute as: **Me**
    - Who has access: **Anyone**
11. Deploy and copy the `/exec` web app URL.
12. Open the dashboard login page, select **Database setup**, paste the URL, and click **Connect**.

## Updating an existing dashboard

1. Open the Sheet’s **Extensions → Apps Script** project.
2. Replace the current `Code.gs` with the complete updated `Code.gs` from this folder.
3. Save, run `setupSystem` once, and approve permissions if Google asks.
4. Select **Deploy → Manage deployments**, edit the existing web app deployment, choose **New version**, and deploy.

Editing the existing deployment keeps the same `/exec` URL. Version 1.1 repairs reporting-period cells that Google Sheets converted into dates, prevents duplicate completion records, and enables the dashboard’s upload history, record viewer, and delete controls.

The setup process creates these tabs automatically:

- Settings
- Users
- Completions
- Imports
- CategoryRules
- MonthlySummary
- AuditLog

`Setup / Repair System` is safe to run again. It repairs missing sheets and headers without deleting existing completion records or users.
