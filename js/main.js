'use strict';

(function () {
  let currentChartGroup = null;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    window.addEventListener('hashchange', handleHashChange);

    setupFilePicker();
    setupDropZone();
    setupFolderPicker();
    setupDemoButton();
    setupDeleteAll();
    setupBackButton();
    setupResetZoom();
    setupMobileZoomButtons();
    setupCompareButton();
    setupCompareBack();

    window.UI.setupGeminiModal();
    window.UI.updateGeminiPills();

    window._processFilesHandler = processFiles;
    window._loadSampleLog = loadSampleLog;

    await refreshHomeView();
    handleHashChange();
  }

  // ── Storage stats ──────────────────────────────────────────────────────────

  async function updateStorageStats() {
    const container = document.getElementById('storage-stats');
    if (!container) return;
    try {
      const estimate = await window.Storage.getStorageEstimate();
      window.UI.renderStorageStats(estimate, container);
    } catch (e) {
      console.warn('Storage stats unavailable:', e);
    }
  }

  // ── Drop zone ──────────────────────────────────────────────────────────────

  function setupDropZone() {
    const zone = document.getElementById('drop-zone');
    if (!zone) return;

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', (e) => {
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('drag-over');
      }
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.csv'));
      if (files.length > 0) {
        processFiles(files);
      } else {
        window.UI.showToast('No .csv files found in the dropped items.', 'warning');
      }
    });
  }

  // ── File picker ────────────────────────────────────────────────────────────

  function setupFilePicker() {
    const input = document.getElementById('file-input');
    const btn   = document.getElementById('btn-file-pick');

    if (btn && input) {
      btn.addEventListener('click', () => input.click());
    }

    if (input) {
      input.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) processFiles(files);
        input.value = '';
      });
    }
  }

  // ── Folder picker (Chromium only) ──────────────────────────────────────────

  function setupFolderPicker() {
    const btn       = document.getElementById('btn-folder-pick');
    const reloadBtn = document.getElementById('btn-reload-folder');

    if (!window.showDirectoryPicker) return;

    if (btn) {
      btn.classList.remove('hidden');
      btn.addEventListener('click', handleFolderPick);
    }

    tryRestoreLastFolderHandle().then(handle => {
      if (handle && reloadBtn) {
        reloadBtn.classList.remove('hidden');
        reloadBtn.addEventListener('click', async () => {
          try {
            const perm = await handle.queryPermission({ mode: 'read' });
            if (perm === 'granted' || await handle.requestPermission({ mode: 'read' }) === 'granted') {
              await processDirectoryHandle(handle);
            } else {
              window.UI.showToast('Permission denied for the saved folder.', 'warning');
            }
          } catch (err) {
            console.error(err);
            window.UI.showToast('Failed to access saved folder.', 'error');
          }
        });
      }
    });
  }

  async function handleFolderPick() {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      await persistFolderHandle(dirHandle);
      await processDirectoryHandle(dirHandle);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        window.UI.showToast('Error opening folder.', 'error');
      }
    }
  }

  async function processDirectoryHandle(dirHandle) {
    const files = [];
    try {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.csv')) {
          files.push(await entry.getFile());
        }
      }
      if (files.length > 0) {
        await processFiles(files);
      } else {
        window.UI.showToast('No .csv files found in the selected folder.', 'warning');
      }
    } catch (err) {
      console.error(err);
      window.UI.showToast('Error reading folder contents.', 'error');
    }
  }

  async function persistFolderHandle(handle) {
    try {
      await new Promise((resolve, reject) => {
        const req = window.indexedDB.open('APLogAnalyzer_Handles', 1);
        req.onupgradeneeded = (e) => {
          if (!e.target.result.objectStoreNames.contains('handles')) {
            e.target.result.createObjectStore('handles');
          }
        };
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction('handles', 'readwrite');
          tx.objectStore('handles').put(handle, 'lastDir');
          tx.oncomplete = resolve;
          tx.onerror = reject;
        };
        req.onerror = reject;
      });
    } catch (e) {
      console.warn('Could not persist folder handle:', e);
    }
  }

  async function tryRestoreLastFolderHandle() {
    try {
      return await new Promise((resolve) => {
        const req = window.indexedDB.open('APLogAnalyzer_Handles', 1);
        req.onupgradeneeded = (e) => {
          if (!e.target.result.objectStoreNames.contains('handles')) {
            e.target.result.createObjectStore('handles');
          }
        };
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction('handles', 'readonly');
          const get = tx.objectStore('handles').get('lastDir');
          get.onsuccess = () => resolve(get.result || null);
          get.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  // ── Delete all ──────────────────────────────────────────────────────────────

  function setupDeleteAll() {
    const btn = document.getElementById('btn-delete-all');
    if (!btn) return;
    btn.addEventListener('click', () => {
      window.UI.showDeleteAllModal(async () => {
        try {
          await window.Storage.deleteAllSessions();
          await refreshHomeView();
          window.UI.showToast('All sessions deleted.', 'success');
        } catch (err) {
          console.error(err);
          window.UI.showToast('Failed to delete sessions.', 'error');
        }
      });
    });
  }

  // ── Back button & Navigation ────────────────────────────────────────────────

  function setupBackButton() {
    const btn = document.getElementById('btn-back');
    if (btn) btn.addEventListener('click', () => { window.location.hash = '#home'; });
  }

  function setupCompareBack() {
    const btn = document.getElementById('btn-compare-back');
    if (btn) btn.addEventListener('click', () => { window.location.hash = '#home'; });
  }

  function setupDemoButton() {
    const btn = document.getElementById('btn-load-demo');
    if (btn) {
      btn.addEventListener('click', () => loadSampleLog());
    }
  }

  function setupMobileZoomButtons() {
    const zoomInBtn = document.getElementById('btn-zoom-in');
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        if (currentChartGroup) currentChartGroup.zoomIn();
      });
    }

    const zoomOutBtn = document.getElementById('btn-zoom-out');
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        if (currentChartGroup) currentChartGroup.zoomOut();
      });
    }
  }

  async function loadSampleLog() {
    try {
      window.UI.showToast('Loading demo FA24 datalog...', 'info');
      const resp = await fetch('docs/sample/sample_log.csv');
      if (!resp.ok) throw new Error('Could not fetch sample log file.');
      const blob = await resp.blob();
      const file = new File([blob], 'sample_stage2_fa24.csv', { type: 'text/csv' });
      await processFiles([file]);
    } catch (err) {
      console.error(err);
      window.UI.showToast('Failed to load demo log: ' + err.message, 'error');
    }
  }

  function setupResetZoom() {
    const btn = document.getElementById('btn-reset-zoom');
    if (btn) {
      btn.addEventListener('click', () => {
        if (currentChartGroup) currentChartGroup.resetZoom();
      });
    }
  }

  function setupCompareButton() {
    const btn = document.getElementById('btn-compare');
    const homeBtn = document.getElementById('btn-home-compare');
    const handleCompareClick = () => { window.location.hash = '#compare'; };

    if (btn) btn.addEventListener('click', handleCompareClick);
    if (homeBtn) homeBtn.addEventListener('click', handleCompareClick);
  }

  // ── Hash routing ─────────────────────────────────────────────────────────────

  async function handleHashChange() {
    const hash = window.location.hash;
    if (!hash || hash === '#home') {
      await refreshHomeView();
    } else if (hash === '#demo' || hash === '#sample') {
      await loadSampleLog();
    } else if (hash.startsWith('#session/')) {
      const id = hash.slice('#session/'.length);
      if (id) await showSessionView(id);
    } else if (hash === '#compare') {
      await showCompareView();
    } else {
      await refreshHomeView();
    }
  }

  // ── Home view ────────────────────────────────────────────────────────────────

  async function refreshHomeView() {
    window.UI.showView('home');
    try {
      const sessions = await window.Storage.loadSessionList();
      window.UI.renderSessionList(sessions, navigateToSession, deleteSession);
      await updateStorageStats();
    } catch (err) {
      console.error(err);
      window.UI.showToast('Error loading sessions.', 'error');
      window.UI.renderEmptyState();
    }
  }

  function navigateToSession(id) {
    window.location.hash = `#session/${id}`;
  }

  async function deleteSession(id) {
    try {
      await window.Storage.deleteSession(id);
      await refreshHomeView();
      window.UI.showToast('Session deleted.', 'success');
    } catch (err) {
      console.error(err);
      window.UI.showToast('Failed to delete session.', 'error');
    }
  }

  // ── Session view ─────────────────────────────────────────────────────────────

  async function showSessionView(sessionId) {
    try {
      if (currentChartGroup) {
        currentChartGroup.destroy();
        currentChartGroup = null;
      }

      const sessions = await window.Storage.loadSessionList();
      const meta = sessions.find(s => s.id === sessionId);
      if (!meta) {
        window.UI.showToast('Session not found.', 'error');
        window.location.hash = '#home';
        return;
      }

      const stored = await window.Storage.loadSessionData(sessionId);
      if (!stored) {
        window.UI.showToast('Session data not found.', 'error');
        window.location.hash = '#home';
        return;
      }

      const session = { ...meta, rows: stored.rows };
      const rawText = stored.rawText || '';

      window.Metrics.computeMetrics(session);
      const findings = window.Findings.runFindings(session);
      session.findings = findings;

      window.UI.showView('session');

      const titleEl = document.getElementById('session-title');
      if (titleEl) titleEl.textContent = meta.tuneName || meta.filename;

      // Render Complete Pro Dashboard (Cockpit, Health, Metric Grid, Good/Better/Worst, AI Lab)
      const headerEl = document.getElementById('session-header');
      if (headerEl) {
        window.UI.renderSessionDashboard(session, findings, headerEl);
      }

      // WOT Pull List
      const pullListEl = document.getElementById('pull-list');
      if (pullListEl) {
        window.UI.renderPullList(session.pulls, pullListEl, (pull) => {
          if (currentChartGroup) currentChartGroup.zoomToPull(pull);
        });
      }

      // Parse summary in sidebar
      const summaryEl = document.getElementById('parse-summary');
      if (summaryEl) {
        summaryEl.innerHTML = `
          <h4 class="sidebar-subtitle">Log Telemetry Stats</h4>
          <ul class="sidebar-meta-list">
            <li><span>Rows Logged:</span> <strong>${session.rowsParsed || 0}</strong></li>
            <li><span>Sampling:</span> <strong>${session.avgIntervalSec ? (1 / session.avgIntervalSec).toFixed(0) : '0'} Hz</strong></li>
            <li><span>Columns:</span> <strong>${session.mapped ? session.mapped.length : 0} channels</strong></li>
            <li><span>Duration:</span> <strong>${session.durationSec ? session.durationSec.toFixed(1) : '0'}s</strong></li>
          </ul>
        `;
      }

      // Charts
      const chartsContainer = document.getElementById('charts-container');
      if (chartsContainer) {
        chartsContainer.innerHTML = '';
        if (window.Charts && window.Charts.ChartGroup) {
          currentChartGroup = new window.Charts.ChartGroup(
            chartsContainer,
            session.rows,
            session.pulls,
            window.Parser.COLUMN_DEFS
          );
        } else {
          chartsContainer.innerHTML = '<p class="error-msg">Charts module unavailable.</p>';
        }
      }

    } catch (err) {
      console.error(err);
      window.UI.showToast('Error loading session: ' + err.message, 'error');
      window.location.hash = '#home';
    }
  }

  // ── Compare view ──────────────────────────────────────────────────────────────

  async function showCompareView() {
    window.UI.showView('compare');
    try {
      const sessions = await window.Storage.loadSessionList();

      const selA = document.getElementById('compare-select-a');
      const selB = document.getElementById('compare-select-b');
      const container = document.getElementById('compare-container');

      if (!selA || !selB) return;

      if (sessions.length < 2) {
        if (container) {
          container.innerHTML = `
            <div class="empty-state-card">
              <div class="empty-state-icon">⚖️</div>
              <h3>Need at least 2 logs to compare</h3>
              <p>Upload another FA24 datalog or load our sample logs to see the side-by-side telemetry battle grid and AI comparison verdict!</p>
            </div>
          `;
        }
        return;
      }

      selA.innerHTML = sessions.map(s =>
        `<option value="${s.id}">${escapeHtml(s.filename)} — ${escapeHtml(s.tuneName || 'Tune')}</option>`
      ).join('');

      selB.innerHTML = sessions.map(s =>
        `<option value="${s.id}">${escapeHtml(s.filename)} — ${escapeHtml(s.tuneName || 'Tune')}</option>`
      ).join('');

      // Default selB to second option
      if (sessions.length > 1) {
        selB.selectedIndex = 1;
      }

      const runBtn = document.getElementById('btn-run-compare');
      if (runBtn) {
        const newBtn = runBtn.cloneNode(true);
        runBtn.parentNode.replaceChild(newBtn, runBtn);
        newBtn.addEventListener('click', async () => {
          const idA = selA.value;
          const idB = selB.value;
          if (!idA || !idB || idA === idB) {
            window.UI.showToast('Select two different sessions to compare.', 'warning');
            return;
          }
          await runCompare(idA, idB, sessions);
        });
      }

      // Auto-run comparison on load
      const idA = selA.value;
      const idB = selB.value;
      if (idA && idB && idA !== idB) {
        await runCompare(idA, idB, sessions);
      }

    } catch (err) {
      console.error(err);
      window.UI.showToast('Error loading sessions for comparison.', 'error');
    }
  }

  async function runCompare(idA, idB, allSessions) {
    try {
      const metaA = allSessions.find(s => s.id === idA);
      const metaB = allSessions.find(s => s.id === idB);

      const [dataA, dataB] = await Promise.all([
        window.Storage.loadSessionData(idA),
        window.Storage.loadSessionData(idB),
      ]);

      if (!dataA || !dataB) {
        window.UI.showToast('Could not load data for comparison.', 'error');
        return;
      }

      const sessionA = { ...metaA, rows: dataA.rows };
      const sessionB = { ...metaB, rows: dataB.rows };

      window.Metrics.computeMetrics(sessionA);
      window.Metrics.computeMetrics(sessionB);

      const findingsA = window.Findings.runFindings(sessionA);
      const findingsB = window.Findings.runFindings(sessionB);
      sessionA.findings = findingsA;
      sessionB.findings = findingsB;

      const container = document.getElementById('compare-container');
      if (container) {
        window.UI.renderCompare(sessionA, sessionB, findingsA, findingsB, container);
      }
    } catch (err) {
      console.error(err);
      window.UI.showToast('Compare failed: ' + err.message, 'error');
    }
  }

  // ── File processing pipeline ──────────────────────────────────────────────────

  async function processFiles(fileList) {
    const count = fileList.length;
    window.UI.showToast(`Processing ${count} datalog${count > 1 ? 's' : ''}…`, 'info');

    let lastSessionId = null;

    for (const file of fileList) {
      try {
        const rawText = await file.text();

        if (!rawText || rawText.trim() === '' || file.size === 0) {
          window.UI.showToast(
            `"${file.name}": This file may not be downloaded from iCloud. In Finder, right-click it and choose Download Now.`,
            'warning'
          );
          continue;
        }

        const result = await window.Parser.parseFile(file);

        if (!result.ok) {
          const code = result.error ? result.error.code : 'UNKNOWN';
          const msg  = result.error ? result.error.message : 'Unknown parse error.';

          if (code === 'ICLOUD_PLACEHOLDER') {
            window.UI.showToast(msg, 'warning');
          } else {
            window.UI.showToast(`"${file.name}": ${msg}`, 'error');
          }
          continue;
        }

        const session = result.session;

        window.Metrics.computeMetrics(session);
        const findings = window.Findings.runFindings(session);
        session.findings = findings;

        await window.Storage.saveSession(session, rawText);
        lastSessionId = session.id;

        const uglyCount = findings.filter(f => f.severity === 'ugly').length;
        const badCount  = findings.filter(f => f.severity === 'bad').length;
        const note = uglyCount > 0
          ? ` — ⚠️ ${uglyCount} ugly finding${uglyCount > 1 ? 's' : ''}`
          : badCount > 0
            ? ` — ${badCount} bad finding${badCount > 1 ? 's' : ''}`
            : ' — ✨ Clean';
        window.UI.showToast(`Loaded "${file.name}"${note}`, uglyCount > 0 ? 'warning' : 'success');

      } catch (err) {
        console.error(err);
        window.UI.showToast(`Error processing "${file.name}": ${err.message}`, 'error');
      }
    }

    await updateStorageStats();

    if (lastSessionId) {
      window.location.hash = `#session/${lastSessionId}`;
    } else {
      await refreshHomeView();
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
