# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (Report Generator Feature)
- New `report-generator.html` page for quick datalog analysis
- Automatic metric extraction from AP CSV files (Boost, AFR, Timing Retard, Knock Count, DAM, RPM, Fuel Pressure)
- Verdict system: Good tune (🟢) / Watch knock (🟡) / Check tune (🔴)
- Local storage of reports using browser IndexedDB (`APReportGeneratorDB`)
- Report history viewer (last 50 reports with auto-pruning)
- Multiple export formats:
  * PDF (share with tuner, formatted print stylesheet)
  * JSON (GitHub repository backup & archival)
  * CSV (Excel/Google Sheets analysis)
- Interactive 2-Stage Mechanical Cassette Tape Deck with tactile sound FX, spinning reels, and eject mechanism
- Expanded 22-Column comprehensive engine telemetry export suite (Boost, AFR, Timing Retard, Knock, DAM, Fuel Pressure, Temps, IAT, Ethanol, IDC, LTFT, Warnings)
- Pre-configured and Base64-obfuscated Google Sheets Web App endpoint with on-screen password masking & toggle
- Local-first XSS output sanitization on all dynamic CSV metadata fields
- Dedicated `/reports/` GitHub backup archive directory
- Standalone architecture ensuring zero modification or dependencies on the primary analyzer dashboard

