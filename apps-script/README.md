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

The setup process creates these tabs automatically:

- Settings
- Users
- Completions
- Imports
- CategoryRules
- MonthlySummary
- AuditLog

`Setup / Repair System` is safe to run again. It repairs missing sheets and headers without deleting existing completion records or users.
