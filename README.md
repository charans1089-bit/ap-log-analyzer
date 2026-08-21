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

## Features Not Built (and Why)
- **No cloud sync**: Would require user accounts, databases, and compromise the strict zero-upload privacy guarantee.
- **No AI/ML analysis**: Would require sending log data to an external API (like OpenAI) along with an API key, violating offline/privacy rules.
- **No fleet comparison**: Comparing your logs to others would require centralizing data on a server, which we intentionally avoid.

## License
MIT License
