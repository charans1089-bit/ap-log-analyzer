'use strict';

(function () {
  let currentChartGroup = null;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    window.addEventListener('hashchange', handleHashChange);

    setupFilePicker();
    setupDropZone();
    setupFolderPicker();
    setupDeleteAll();
    setupBackButton();
    setupResetZoom();
    setupCompareButton();
    setupCompareBack();

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
    const zone = document.getElementById('drop-zone');  // matches index.html id="drop-zone"
    if (!zone) return;

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', (e) => {
      // Only remove if leaving the zone entirely (not entering a child)
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
    const input = document.getElementById('file-input');   // matches id="file-input"
    const btn   = document.getElementById('btn-file-pick'); // matches id="btn-file-pick"

    if (btn && input) {
      btn.addEventListener('click', () => input.click());
    }

    if (input) {
      input.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) processFiles(files);
        // Reset so the same file can be re-selected
        input.value = '';
      });
    }
  }

  // ── Folder picker (Chrome / Chromium only) ─────────────────────────────────

  function setupFolderPicker() {
    const btn       = document.getElementById('btn-folder-pick');   // matches id="btn-folder-pick"
    const reloadBtn = document.getElementById('btn-reload-folder'); // matches id="btn-reload-folder"

    // If the API is absent, leave the buttons hidden (HTML default: class="hidden")
    if (!window.showDirectoryPicker) return;

    // API present — show the button
    if (btn) {
      btn.classList.remove('hidden');
      btn.addEventListener('click', handleFolderPick);
    }

    // Check for a persisted handle
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

  // Persist/restore directory handle using a dedicated "handles" store
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
    const btn = document.getElementById('btn-delete-all'); // matches id="btn-delete-all"
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

  // ── Back button ──────────────────────────────────────────────────────────────

  function setupBackButton() {
    const btn = document.getElementById('btn-back'); // matches id="btn-back"
    if (btn) btn.addEventListener('click', () => { window.location.hash = '#home'; });
  }

  function setupCompareBack() {
    const btn = document.getElementById('btn-compare-back');
    if (btn) btn.addEventListener('click', () => { window.location.hash = '#home'; });
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
    if (btn) btn.addEventListener('click', () => { window.location.hash = '#compare'; });
  }

  // ── Hash routing ─────────────────────────────────────────────────────────────

  function handleHashChange() {
    const hash = window.location.hash;
    if (!hash || hash === '#home') {
      refreshHomeView();
    } else if (hash.startsWith('#session/')) {
      const id = hash.slice('#session/'.length);
      if (id) showSessionView(id);
    } else if (hash === '#compare') {
      showCompareView();
    } else {
      refreshHomeView();
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
      // Destroy previous charts to release canvas listeners
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

      // Re-hydrate full session from stored meta + rows
      const session = { ...meta, rows: stored.rows };
      const rawText = stored.rawText || '';

      // Re-run metrics and findings (rows are plain objects; metrics mutates session in place)
      window.Metrics.computeMetrics(session);
      const findings = window.Findings.runFindings(session);
      session.findings = findings;

      window.UI.showView('session');

      // Session title in toolbar
      const titleEl = document.getElementById('session-title');
      if (titleEl) titleEl.textContent = meta.tuneName || meta.filename;

      // Header stats
      const headerEl = document.getElementById('session-header');
      if (headerEl) window.UI.renderSessionHeader(session, findings, headerEl);

      // Pull list
      const pullListEl = document.getElementById('pull-list');
      if (pullListEl) {
        window.UI.renderPullList(session.pulls, pullListEl, (pull) => {
          if (currentChartGroup) currentChartGroup.zoomToPull(pull);
        });
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

      // Parse summary
      const summaryEl = document.getElementById('parse-summary');
      if (summaryEl) window.UI.renderParseSummary(session, summaryEl);

      // Findings
      const findingsEl = document.getElementById('findings-container');
      if (findingsEl) window.UI.renderFindings(findings, findingsEl);

      // Recommendations
      const recsEl = document.getElementById('recommendations-container');
      if (recsEl) window.UI.renderRecommendations(findings, recsEl);

      // Export buttons
      const exportEl = document.getElementById('export-container');
      if (exportEl) window.UI.renderExportButtons(session, rawText, findings, exportEl);

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

      if (!selA || !selB) return;

      [selA, selB].forEach(sel => {
        sel.innerHTML = sessions.map(s =>
          `<option value="${s.id}">${escapeHtml(s.filename)} — ${escapeHtml(s.tuneName || 'Unknown')}</option>`
        ).join('');
      });

      const runBtn = document.getElementById('btn-run-compare');
      if (runBtn) {
        // Remove previous listener by replacing element
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
    window.UI.showToast(`Processing ${count} file${count > 1 ? 's' : ''}…`, 'info');

    let lastSessionId = null;

    for (const file of fileList) {
      try {
        // Read raw text first (parseFile also reads it internally but we need it for storage)
        const rawText = await file.text();

        // Detect iCloud placeholder before handing to parser
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

        // Enrich with metrics and findings
        window.Metrics.computeMetrics(session);
        const findings = window.Findings.runFindings(session);
        session.findings = findings;

        // Persist to IndexedDB (raw text stored for export)
        await window.Storage.saveSession(session, rawText);
        lastSessionId = session.id;

        const uglyCount = findings.filter(f => f.severity === 'ugly').length;
        const badCount  = findings.filter(f => f.severity === 'bad').length;
        const note = uglyCount > 0
          ? ` — ⚠ ${uglyCount} ugly finding${uglyCount > 1 ? 's' : ''}`
          : badCount > 0
            ? ` — ${badCount} bad finding${badCount > 1 ? 's' : ''}`
            : '';
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
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

})();
