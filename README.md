# TargetSolutions Dashboard

A professional, simple monthly completion dashboard for Martinsville Fire & EMS.

## What it does

- Signs users in from the Google Sheet `Users` tab
- Imports TargetSolutions `Monthly Master Completions` CSV files
- Blocks repeat completion records and exact duplicate reports
- Validates and commits every month in a multi-month report as one protected batch
- Detects and safely replaces previously uploaded months when the report has changed
- Lets administrators review, search, and delete uploaded report batches
- Displays monthly, yearly, and all-time totals
- Keeps every required dashboard area visible, including zero totals
- Combines all training types into one Training total
- Preserves unmatched assignments in Needs Review
- Opens the records behind every dashboard number

## Google Sheets backend

The complete copy-and-paste backend is in [`apps-script/Code.gs`](apps-script/Code.gs).
Follow [`apps-script/README.md`](apps-script/README.md) to create and deploy the Google Apps Script web app.

The first setup creates this temporary login:

- Username: `admin`
- Password: `ChangeMe123!`

Change that password on the `Users` sheet before sharing the dashboard.

## Connect the website

Open the login page, select **Database setup**, paste the deployed Google Apps Script `/exec` URL, and click **Connect**. The connection is saved only in that browser.

## Hosting

The production frontend is published to GitHub Pages from the `main` branch by
the workflow in `.github/workflows/deploy-pages.yml`. The GitHub Pages build is
a static export; all application data and login operations continue to use the
Google Apps Script web app and Google Sheet described above.

The existing Sites build remains available as a rollback target. The GitHub
Pages configuration is enabled only by `npm run build:pages`, so it does not
alter the existing Sites build.

## Design notes

The site is intentionally focused:

- One dashboard
- One upload flow
- One upload-management screen for administrators
- Month, year, and all-time period controls
- No complicated account management screen
- Users are managed directly from Google Sheets

## Local development

```bash
npm install
npm run dev
```

To verify the GitHub Pages artifact locally:

```bash
npm run build:pages
```
