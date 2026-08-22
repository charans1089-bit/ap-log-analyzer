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
- Optional GitHub integration (step-by-step instructions & CLI snippet)
- Optional Google Sheets sync (cloud webhook sync and 1-click clipboard row copy)
- Retro 80s/90s arcade aesthetic with CRT scanlines, neon palette, and 8-bit synthesized Web Audio sound FX
- Multi-track 8-bit Synthwave Chiptune BGM music engine (100% offline Web Audio sequencer with lead melody, arpeggios, bassline & percussion)
- Retro Boombox & SoundCloud radio drawer with curated free Creative Commons synthwave streams, track switcher, and volume controls
- Comparison tool (compare 2 reports side-by-side with delta analysis)
- Standalone architecture ensuring zero modification or dependencies on the primary analyzer dashboard

