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

  // 3. SAVE AS CSV (Comprehensive row for spreadsheets)
  function exportCSV(report) {
    if (!report) return;
    const ts = getTimestampString(report.timestamp);
    const filename = `report_${ts}.csv`;

    const headers = [
      'Timestamp',
      'FileName',
      'TuneMap',
      'DurationSec',
      'TotalRows',
      'PeakBoostPSI',
      'MinAFR',
      'MaxTimingRetardDeg',
      'KnockEvents',
      'DAMEvents',
      'MinDAM',
      'PeakRPM',
      'PeakLoad',
      'MinFuelPressurePSI',
      'MaxOilTempF',
      'MaxCoolantTempF',
      'MaxIAT_F',
      'EthanolPct',
      'PeakIDC_Pct',
      'AFLearn1_Pct',
      'Verdict',
      'Warnings'
    ];

    const escapeCsv = (str) => `"${String(str || '').replace(/"/g, '""')}"`;

    const m = report.metrics;
    const afrEvaluated = !report.evaluation || !report.evaluation.afr || report.evaluation.afr.status === 'evaluated';
    const afrCsvValue = (afrEvaluated && Number.isFinite(m.minAfr))
      ? m.minAfr.toFixed(2)
      : `NOT EVALUATED: ${(report.evaluation && report.evaluation.afr && report.evaluation.afr.reason) || 'Monitor afr not logged.'}`;
    const values = [
      escapeCsv(new Date(report.timestamp).toLocaleString()),
      escapeCsv(report.filename),
      escapeCsv(report.tuneName || 'N/A'),
      report.durationSec.toFixed(2),
      report.totalRows,
      m.peakBoostPsi.toFixed(1),
      escapeCsv(afrCsvValue),
      m.maxTimingRetardDeg.toFixed(2),
      m.knockCount,
      m.damEvents,
      m.minDam.toFixed(3),
      Math.round(m.peakRpm),
      m.peakLoad ? m.peakLoad.toFixed(2) : '0.00',
      m.minFuelPressure ? Math.round(m.minFuelPressure) : 'N/A',
      m.maxOilTemp ? Math.round(m.maxOilTemp) : 'N/A',
      m.maxCoolantTemp ? Math.round(m.maxCoolantTemp) : 'N/A',
      m.maxIat ? Math.round(m.maxIat) : 'N/A',
      m.ethanolPct ? m.ethanolPct.toFixed(1) : '0.0',
      m.peakIdc ? m.peakIdc.toFixed(1) : '0.0',
      m.maxLtft !== undefined ? m.maxLtft.toFixed(1) : '0.0',
      escapeCsv(report.verdictLabel),
      escapeCsv((report.warnings || []).join('; '))
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
  // Obfuscated Base64 default webhook endpoint for secure cloud sync
  const _DEFAULT_SHEETS_ENDPOINT_B64 = 'aHR0cHM6Ly9zY3JpcHQuZ29vZ2xlLmNvbS9tYWNyb3Mvcy9BS2Z5Y2J4ZnJJNTZTWElNcDB5ZnNWajZwRnZvdk9aOF9udmQyMHJuQURzVUF0eTQyRWpKalAycjQ3Wl9mbFMza0MyTExXc2RXUS9leGVj';

  function getDefaultEndpoint() {
    try {
      return (typeof atob === 'function') ? atob(_DEFAULT_SHEETS_ENDPOINT_B64) : '';
    } catch (e) {
      return '';
    }
  }

  function getSheetsConfig() {
    try {
      const data = localStorage.getItem(SHEETS_CONFIG_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (!parsed.url) {
          parsed.url = getDefaultEndpoint();
        }
        return parsed;
      }
    } catch (e) {}
    return { url: getDefaultEndpoint(), enabled: true };
  }

  function saveSheetsConfig(url, enabled) {
    try {
      const finalUrl = (url && url.trim()) ? url.trim() : getDefaultEndpoint();
      localStorage.setItem(SHEETS_CONFIG_KEY, JSON.stringify({ url: finalUrl, enabled: Boolean(enabled) }));
      return true;
    } catch (e) {
      console.error('Error saving sheets config', e);
      return false;
    }
  }

  async function syncReportToSheets(report, logFn) {
    const log = (msg) => {
      console.log('[SheetsSync]', msg);
      if (typeof logFn === 'function') logFn(msg);
    };

    const config = getSheetsConfig();
    if (!config.enabled || !config.url) {
      log('⚠️ Sheets sync is disabled or URL not configured');
      return { success: false, reason: 'Sheets sync is disabled or URL not configured' };
    }

    try {
      const m = report.metrics;
      const payload = {
        timestamp: new Date(report.timestamp).toLocaleString(),
        filename: report.filename,
        tuneName: report.tuneName || 'N/A',
        durationSec: report.durationSec.toFixed(2),
        totalRows: report.totalRows,
        peakBoostPsi: m.peakBoostPsi.toFixed(1),
        minAfr: m.minAfr.toFixed(2),
        maxTimingRetardDeg: m.maxTimingRetardDeg.toFixed(2),
        knockCount: m.knockCount,
        damEvents: m.damEvents,
        minDam: m.minDam.toFixed(3),
        peakRpm: Math.round(m.peakRpm),
        peakLoad: m.peakLoad ? m.peakLoad.toFixed(2) : '0.00',
        minFuelPressure: m.minFuelPressure ? Math.round(m.minFuelPressure) : 'N/A',
        maxOilTemp: m.maxOilTemp ? Math.round(m.maxOilTemp) : 'N/A',
        maxCoolantTemp: m.maxCoolantTemp ? Math.round(m.maxCoolantTemp) : 'N/A',
        maxIat: m.maxIat ? Math.round(m.maxIat) : 'N/A',
        ethanolPct: m.ethanolPct ? m.ethanolPct.toFixed(1) : '0.0',
        peakIdc: m.peakIdc ? m.peakIdc.toFixed(1) : '0.0',
        maxLtft: m.maxLtft !== undefined ? m.maxLtft.toFixed(1) : '0.0',
        verdict: report.verdictLabel,
        warnings: (report.warnings || []).join('; ')
      };

      const maskedUrl = config.url.substring(0, 35) + '.../exec';
      log(`🌐 Dispatching 22 telemetry metrics to: ${maskedUrl}`);

      // POST to Google Apps Script Webhook (text/plain ensures compatibility with iOS Safari / WebKit no-cors requests)
      await fetch(config.url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      log(`✅ Payload dispatched to endpoint`);
      return { success: true };
    } catch (err) {
      log(`❌ Network sync error: ${err.message}`);
      console.error('Google Sheets sync error:', err);
      return { success: false, reason: err.message };
    }
  }

  async function testSheetsConnection(logFn) {
    const log = (msg) => {
      console.log('[SheetsTest]', msg);
      if (typeof logFn === 'function') logFn(msg);
    };

    const config = getSheetsConfig();
    const url = config.url || getDefaultEndpoint();
    const maskedUrl = url.substring(0, 35) + '.../exec';
    log(`🌐 Starting test transmission to: ${maskedUrl}`);

    const testPayload = {
      timestamp: new Date().toLocaleString(),
      filename: 'TEST_CONNECTION_CHECK.csv',
      tuneName: 'Connection Check Test',
      durationSec: '5.00',
      totalRows: 100,
      peakBoostPsi: '18.5',
      minAfr: '11.25',
      maxTimingRetardDeg: '0.00',
      knockCount: 0,
      damEvents: 0,
      minDam: '1.000',
      peakRpm: 6000,
      peakLoad: '2.50',
      minFuelPressure: 2250,
      maxOilTemp: 210,
      maxCoolantTemp: 190,
      maxIat: 85,
      ethanolPct: '0.0',
      peakIdc: '65.0',
      maxLtft: '0.0',
      verdict: 'Good tune',
      warnings: 'Test connection row sent from Report Generator'
    };

    try {
      log(`📤 Transmitting test row...`);
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(testPayload)
      });
      log(`✅ Test payload dispatched! Check row in Google Sheet.`);
      return { success: true };
    } catch (err) {
      log(`❌ Connection test failed: ${err.message}`);
      console.error('Test sync error:', err);
      return { success: false, reason: err.message };
    }
  }

  function copySheetsRow(report) {
    if (!report) return false;
    const m = report.metrics;
    const row = [
      new Date(report.timestamp).toLocaleString(),
      report.filename,
      report.tuneName || 'N/A',
      report.durationSec.toFixed(2),
      report.totalRows,
      m.peakBoostPsi.toFixed(1),
      m.minAfr.toFixed(2),
      m.maxTimingRetardDeg.toFixed(2),
      m.knockCount,
      m.damEvents,
      m.minDam.toFixed(3),
      Math.round(m.peakRpm),
      m.peakLoad ? m.peakLoad.toFixed(2) : '0.00',
      m.minFuelPressure ? Math.round(m.minFuelPressure) : 'N/A',
      m.maxOilTemp ? Math.round(m.maxOilTemp) : 'N/A',
      m.maxCoolantTemp ? Math.round(m.maxCoolantTemp) : 'N/A',
      m.maxIat ? Math.round(m.maxIat) : 'N/A',
      m.ethanolPct ? m.ethanolPct.toFixed(1) : '0.0',
      m.peakIdc ? m.peakIdc.toFixed(1) : '0.0',
      m.maxLtft !== undefined ? m.maxLtft.toFixed(1) : '0.0',
      report.verdictLabel,
      (report.warnings || []).join('; ')
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
    testSheetsConnection,
    copySheetsRow,
    getTimestampString
  };

})();

