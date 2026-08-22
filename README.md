# AP Log Analyzer

## What It Does
AP Log Analyzer is a local, privacy-first web application designed to help you quickly identify issues in data logs exported from a COBB AccessPort (AP), specifically tuned for the Subaru FA24 engine. It parses tab-delimited CSV log files, evaluates specific metrics against known thresholds for FA24 health, and flags anomalies as UGLY, BAD, or notable findings, saving you hours of manual spreadsheet review.

## Privacy
All log data stays entirely in your browser's IndexedDB storage. No data is uploaded anywhere. No API calls are made. No analytics. No CDN resources. The application works completely offline in airplane mode after the first load.

## Getting Started

### Open Locally (file://)
You can simply open `index.html` directly in your browser without running a local web server. The app is completely self-contained.

### Deploy to GitHub Pages
To host the analyzer yourself using GitHub Pages:
1. Go to your repository **Settings** → **Pages**
2. Under **Source**, select **Deploy from branch**
3. Select **Branch: main** and the **/root** directory
4. Save. Your site will be available at `https://username.github.io/repo-name`

## How to Export a Log from the AccessPort
To export logs for analysis:
1. Connect your AccessPort to your computer via USB.
2. In Accessport Manager, go to **Settings** → **Datalog** → **Manage Logs**
3. Select the log you want to export.
4. Click **Export via USB** and save it to your computer.

## Column Mapping
The analyzer reads your CSV header row and automatically maps AP monitors to its internal logic. Column names are matched case-insensitively and unit-tolerantly to the exact FA24 header set, so variations like `RPM(RPM)` vs `rpm (rpm)` are handled gracefully.

## Standalone Datalog Report Generator
In addition to the main telemetry dashboard, the project includes a standalone **Retro Datalog Report Generator** (`report-generator.html`):
- **Quick Health Reports:** Instantly parses COBB AccessPort CSV logs and provides a calibration verdict: *Good tune* (🟢), *Watch knock* (🟡), or *Check tune* (🔴).
- **Metric Extraction:** Computes peak boost, minimum AFR under boost, max timing retard, knock events, and Dynamic Advance Multiplier (DAM) health.
- **Export Options:** Export reports as **PDF** (formatted tuning summary sheet), **JSON** (schema backup for `/reports/`), or **CSV** (spreadsheet row).
- **Local Storage:** Stores the last 50 reports locally in browser IndexedDB with a vintage filing cabinet viewer and side-by-side comparison tool.
- **Retro Arcade Aesthetic:** Complete with CRT scanlines, 80s/90s neon styling, and 8-bit synthesized Web Audio feedback.
- **Integrations:** Optional GitHub commit instructions and Google Sheets cloud sync.

### Report Generator File Structure
```
ap-log-analyzer/
├── report-generator.html   # Standalone page for datalog report generation
├── report-generator.js     # Telemetry parsing, verdict rules & IndexedDB storage
├── report-export.js        # PDF print, JSON, CSV & Google Sheets export engine
├── report-styles.css       # Retro arcade styling, CRT animations & print styles
├── CHANGELOG.md            # Release notes and feature changelog
└── reports/                # (Recommended) Directory for archived JSON reports
```

For complete documentation, monitor dictionary, and walkthroughs, open `docs.html`.

## Features Not Built (and Why)
- **No central server**: All telemetry processing and IndexedDB storage remain 100% private in your browser.
- **No fleet comparison**: Comparing your logs to others would require centralizing data on a server, which we intentionally avoid.

## License
MIT License
MIT License
