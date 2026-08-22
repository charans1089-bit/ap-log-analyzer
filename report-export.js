/**
 * DATALOG REPORT GENERATOR - EXPORT & INTEGRATION ENGINE
 * Handles PDF (Print), JSON, CSV, GitHub Instructions, and Google Sheets Sync
 */

'use strict';

(function() {

  function getTimestampString(dateObj) {
    const d = dateObj ? new Date(dateObj) : new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const mins = pad(d.getMinutes());
    const secs = pad(d.getSeconds());
    return `${year}-${month}-${day}_${hours}-${mins}-${secs}`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // 1. SAVE AS PDF (Native Print Dialog with custom document title)
  function exportPDF(report) {
    if (!report) return;
    const originalTitle = document.title;
    const ts = getTimestampString(report.timestamp);
    const pdfFilename = `SCRK_Report_${ts}`;
    document.title = pdfFilename;

    window.print();

    // Restore title after print dialog closes
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  }

  // 2. SAVE AS JSON (Detailed report schema for archival / GitHub backup)
  function exportJSON(report) {
    if (!report) return;
    const ts = getTimestampString(report.timestamp);
    const filename = `report_${ts}.json`;

    const exportData = {
      version: '1.0.0',
      generator: 'AP Log Analyzer Pro - Retro Report Generator',
      generatedAt: new Date(report.timestamp).toISOString(),
      session: {
        filename: report.filename,
        durationSec: report.durationSec,
        totalRows: report.totalRows,
        apInfo: report.apInfo || '',
        tuneName: report.tuneName || ''
      },
      verdict: {
        verdict: report.verdict,
        verdictLabel: report.verdictLabel,
        isSafe: report.verdict === 'good'
      },
      metrics: {
        peakBoostPsi: report.metrics.peakBoostPsi,
        minAfr: report.metrics.minAfr,
        maxTimingRetardDeg: report.metrics.maxTimingRetardDeg,
        knockCount: report.metrics.knockCount,
        damEvents: report.metrics.damEvents,
        minDam: report.metrics.minDam,
        peakRpm: report.metrics.peakRpm,
        peakLoad: report.metrics.peakLoad,
        minFuelPressure: report.metrics.minFuelPressure,
        maxOilTemp: report.metrics.maxOilTemp,
        maxCoolantTemp: report.metrics.maxCoolantTemp
      },
      safeRanges: report.safeRanges,
      warnings: report.warnings || [],
      outOfSpecMoments: report.outOfSpecMoments || []
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, filename);
  }

  // 3. SAVE AS CSV (Summary row for spreadsheets)
  function exportCSV(report) {
    if (!report) return;
    const ts = getTimestampString(report.timestamp);
    const filename = `report_${ts}.csv`;

    const headers = [
      'Timestamp',
      'FileName',
      'DurationSec',
      'TotalRows',
      'PeakBoostPSI',
      'MinAFR',
      'MaxTimingRetardDeg',
      'KnockCount',
      'DAMEvents',
      'MinDAM',
      'PeakRPM',
      'Verdict',
      'WarningsCount'
    ];

    const escapeCsv = (str) => `"${String(str || '').replace(/"/g, '""')}"`;

    const values = [
      escapeCsv(new Date(report.timestamp).toLocaleString()),
      escapeCsv(report.filename),
      report.durationSec.toFixed(2),
      report.totalRows,
      report.metrics.peakBoostPsi.toFixed(1),
      report.metrics.minAfr.toFixed(2),
      report.metrics.maxTimingRetardDeg.toFixed(2),
      report.metrics.knockCount,
      report.metrics.damEvents,
      report.metrics.minDam.toFixed(3),
      Math.round(report.metrics.peakRpm),
      escapeCsv(report.verdictLabel),
      (report.warnings || []).length
    ];

    const csvContent = headers.join(',') + '\n' + values.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, filename);
  }

  // 4. GITHUB INSTRUCTIONS & CLIPBOARD HELPER
  function getGitHubInstructions(report) {
    const ts = getTimestampString(report ? report.timestamp : Date.now());
    return `### 🔧 BACKUP TELEMETRY REPORT TO GITHUB

1. Click "SAVE AS JSON" to download: report_${ts}.json
2. Open your terminal and clone your ap-log-analyzer repo:
   git clone https://github.com/<your-username>/ap-log-analyzer.git
3. Move the report into the /reports/ directory:
   mkdir -p ./ap-log-analyzer/reports
   cp ~/Downloads/report_${ts}.json ./ap-log-analyzer/reports/
4. Commit and push:
   cd ./ap-log-analyzer
   git add reports/
   git commit -m "Add datalog health report: ${ts}"
   git push origin main

⚡ Fast GitHub CLI One-Liner:
gh repo clone <your-username>/ap-log-analyzer && mkdir -p ./ap-log-analyzer/reports && cp ~/Downloads/report_${ts}.json ./ap-log-analyzer/reports/ && cd ./ap-log-analyzer && git add reports/ && git commit -m "Add report ${ts}" && git push`;
  }

  async function copyGitHubInstructions(report) {
    const text = getGitHubInstructions(report);
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Clipboard write failed, falling back to execCommand', err);
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    }
  }

  // 5. GOOGLE SHEETS CLOUD INTEGRATION
  const SHEETS_CONFIG_KEY = 'ap_report_generator_sheets_config';

  function getSheetsConfig() {
    try {
      const data = localStorage.getItem(SHEETS_CONFIG_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {}
    return { url: '', enabled: false };
  }

  function saveSheetsConfig(url, enabled) {
    try {
      localStorage.setItem(SHEETS_CONFIG_KEY, JSON.stringify({ url: url.trim(), enabled: Boolean(enabled) }));
      return true;
    } catch (e) {
      console.error('Error saving sheets config', e);
      return false;
    }
  }

  async function syncReportToSheets(report) {
    const config = getSheetsConfig();
    if (!config.enabled || !config.url) {
      return { success: false, reason: 'Sheets sync is disabled or URL not configured' };
    }

    try {
      const payload = {
        timestamp: new Date(report.timestamp).toISOString(),
        filename: report.filename,
        durationSec: report.durationSec,
        peakBoostPsi: report.metrics.peakBoostPsi,
        minAfr: report.metrics.minAfr,
        maxTimingRetardDeg: report.metrics.maxTimingRetardDeg,
        knockCount: report.metrics.knockCount,
        damEvents: report.metrics.damEvents,
        minDam: report.metrics.minDam,
        peakRpm: report.metrics.peakRpm,
        verdict: report.verdictLabel
      };

      // POST to Google Apps Script Webhook / endpoint
      await fetch(config.url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      return { success: true };
    } catch (err) {
      console.error('Google Sheets sync error:', err);
      return { success: false, reason: err.message };
    }
  }

  function copySheetsRow(report) {
    if (!report) return false;
    const row = [
      new Date(report.timestamp).toLocaleString(),
      report.filename,
      report.durationSec.toFixed(2),
      report.metrics.peakBoostPsi.toFixed(1),
      report.metrics.minAfr.toFixed(2),
      report.metrics.maxTimingRetardDeg.toFixed(2),
      report.metrics.knockCount,
      report.metrics.damEvents,
      report.metrics.minDam.toFixed(3),
      Math.round(report.metrics.peakRpm),
      report.verdictLabel
    ].join('\t');

    try {
      navigator.clipboard.writeText(row);
      return true;
    } catch (e) {
      return false;
    }
  }

  window.ReportExport = {
    exportPDF,
    exportJSON,
    exportCSV,
    getGitHubInstructions,
    copyGitHubInstructions,
    getSheetsConfig,
    saveSheetsConfig,
    syncReportToSheets,
    copySheetsRow,
    getTimestampString
  };

})();

