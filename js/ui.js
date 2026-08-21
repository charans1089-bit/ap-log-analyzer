'use strict';

window.UI = (function() {
  function showToast(message, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('fading');
      setTimeout(() => {
        if (container.contains(toast)) {
          container.removeChild(toast);
        }
      }, 300);
    }, 5000);
  }

  function renderSessionList(sessions, onNavigate, onDelete) {
    const container = document.getElementById('session-list');
    if (!container) return;
    container.innerHTML = '';

    if (!sessions || sessions.length === 0) {
      renderEmptyState();
      return;
    }

    sessions.forEach(session => {
      const item = document.createElement('div');
      item.className = 'session-item';

      const uglyCount = session.findings ? session.findings.filter(f => f.severity === 'ugly').length : 0;
      const badCount  = session.findings ? session.findings.filter(f => f.severity === 'bad').length  : 0;

      item.innerHTML = `
        <div class="session-info">
          <h3>${escapeHtml(session.filename)}</h3>
          <p>Tune: ${escapeHtml(session.tuneName || 'Unknown')}</p>
          <p>Date: ${new Date(session.loadedAt).toLocaleString()}</p>
          <p>Duration: ${session.durationSec ? session.durationSec.toFixed(2) : 'N/A'}s</p>
          <div class="session-badges">
            ${uglyCount > 0 ? `<span class="badge badge-ugly">${uglyCount} Ugly</span>` : ''}
            ${badCount  > 0 ? `<span class="badge badge-bad">${badCount} Bad</span>`   : ''}
            ${uglyCount === 0 && badCount === 0 ? '<span class="badge badge-good">Clean</span>' : ''}
          </div>
        </div>
        <div class="session-actions">
          <button class="btn-secondary btn-sm delete-btn" data-id="${escapeHtml(session.id)}">Delete</button>
        </div>
      `;

      item.querySelector('.session-info').addEventListener('click', () => {
        if (onNavigate) onNavigate(session.id);
        else window.location.hash = `#session/${session.id}`;
      });

      item.querySelector('.delete-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Delete session "${escapeHtml(session.filename)}"?`)) {
          if (onDelete) {
            await onDelete(session.id);
          } else {
            await window.Storage.deleteSession(session.id);
            const updated = await window.Storage.loadSessionList();
            renderSessionList(updated, null, null);
            showToast('Session deleted', 'success');
          }
        }
      });

      container.appendChild(item);
    });
  }

  function renderEmptyState() {
    const container = document.getElementById('session-list');
    if (!container) return;
    container.innerHTML = `
      <div class="empty-state">
        <h3>No sessions found</h3>
        <p>Plug in your COBB AccessPort &rarr; Settings &rarr; Datalog &rarr; Manage Logs &rarr; Export via USB</p>
        <p>Then upload your .csv logs here to analyze them.</p>
      </div>
    `;
  }

  function renderParseSummary(session, container) {
    if (!container) return;
    container.innerHTML = `
      <h3>Parse Summary</h3>
      <ul>
        <li>Rows parsed: ${session.rowsParsed || 0}</li>
        <li>Rows skipped: ${session.rowsSkipped || 0}</li>
        <li>Duration: ${session.durationSec ? session.durationSec.toFixed(2) : 0}s</li>
        <li>Sample rate (avg interval): ${session.avgIntervalSec ? (1 / session.avgIntervalSec).toFixed(1) : 0} Hz</li>
        <li>Mapped columns: ${session.mapped ? session.mapped.length : 0}</li>
        <li>Unmapped columns: ${session.unmapped ? session.unmapped.length : 0}</li>
        ${session.missingRecommended && session.missingRecommended.length > 0 
          ? `<li><span class="warning">Missing recommended: ${session.missingRecommended.join(', ')}</span></li>` 
          : ''}
      </ul>
    `;
  }

  function renderSessionHeader(session, findings, container) {
    if (!container) return;
    const stats = session.stats || {};
    
    const uglyCount = findings.filter(f => f.severity === 'ugly').length;
    const badCount = findings.filter(f => f.severity === 'bad').length;
    const goodCount = findings.filter(f => f.severity === 'good').length;

    container.innerHTML = `
      <h2>${escapeHtml(session.filename)}</h2>
      <div class="header-stats">
        <p><strong>Date:</strong> ${new Date(session.loadedAt).toLocaleString()}</p>
        <p><strong>Duration:</strong> ${session.durationSec ? session.durationSec.toFixed(2) : 0}s</p>
        <p><strong>Tune:</strong> ${escapeHtml(session.tuneName || 'Unknown')}</p>
        <p><strong>Max RPM:</strong> ${stats.maxRpm ? stats.maxRpm.toFixed(0) : 'N/A'}</p>
        <p><strong>Max Boost:</strong> ${stats.maxBoost ? stats.maxBoost.toFixed(2) : 'N/A'} psi</p>
        <p><strong>Peak Load:</strong> ${stats.peakLoad ? stats.peakLoad.toFixed(2) : 'N/A'}</p>
        <p><strong>Ethanol:</strong> ${stats.ethanolPct !== undefined && stats.ethanolPct !== null ? stats.ethanolPct.toFixed(1) + '%' : 'N/A'}</p>
        <p><strong>IAT Range:</strong> ${stats.iatMin !== undefined ? stats.iatMin.toFixed(0) : 'N/A'} - ${stats.iatMax !== undefined ? stats.iatMax.toFixed(0) : 'N/A'}</p>
        <p><strong>Oil Temp Range:</strong> ${stats.oilTempMin !== undefined ? stats.oilTempMin.toFixed(0) : 'N/A'} - ${stats.oilTempMax !== undefined ? stats.oilTempMax.toFixed(0) : 'N/A'}</p>
      </div>
      <div class="session-badges">
        <span class="badge badge-ugly">${uglyCount} Ugly</span>
        <span class="badge badge-bad">${badCount} Bad</span>
        <span class="badge badge-good">${goodCount} Good</span>
      </div>
    `;
  }

  function renderPullList(pulls, containerOrCallback, onPullClick) {
    // Accepts (pulls, container, onPullClick) OR legacy (pulls, onPullClick)
    let container, callback;
    if (containerOrCallback && typeof containerOrCallback === 'function') {
      container = document.getElementById('pull-list');
      callback = containerOrCallback;
    } else {
      container = containerOrCallback || document.getElementById('pull-list');
      callback = onPullClick;
    }
    if (!container) return;

    container.innerHTML = '';

    if (!pulls || pulls.length === 0) {
      container.innerHTML = '<p class="muted">No WOT pulls detected.</p>';
      return;
    }

    pulls.forEach((pull, i) => {
      const btn = document.createElement('button');
      btn.className = 'pull-item';
      btn.innerHTML =
        `<span class="pull-num">Pull #${i + 1}</span> ` +
        `<span class="pull-time">${pull.startTime.toFixed(2)}s\u2013${pull.endTime.toFixed(2)}s</span> ` +
        `<span class="pull-rpm">${pull.startRpm.toFixed(0)}\u2192${pull.peakRpm.toFixed(0)} RPM</span> ` +
        `<span class="pull-boost">${pull.peakBoost.toFixed(1)} psi pk</span>`;
      btn.addEventListener('click', () => {
        container.querySelectorAll('.pull-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (callback) callback(pull);
      });
      container.appendChild(btn);
    });
  }

  function renderFindings(findings, container) {
    if (!container) return;
    container.innerHTML = '<h3>Findings</h3>';
    
    const ugly = findings.filter(f => f.severity === 'ugly');
    const bad = findings.filter(f => f.severity === 'bad');
    const good = findings.filter(f => f.severity === 'good');
    const cannot = findings.filter(f => f.severity === 'cannot_evaluate');

    if (ugly.length === 0 && bad.length === 0) {
      const banner = document.createElement('div');
      banner.className = 'banner banner-success';
      banner.textContent = 'No critical findings';
      container.appendChild(banner);
    }

    const renderGroup = (title, items, className) => {
      if (items.length === 0) return;
      const group = document.createElement('div');
      group.className = 'findings-group';
      group.innerHTML = `<h4>${title} (${items.length})</h4>`;
      const ul = document.createElement('ul');
      items.forEach(f => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="badge badge-${className}">${f.severity.toUpperCase()}</span> 
                        <strong>${escapeHtml(f.label)}:</strong> ${escapeHtml(f.message)} 
                        <br><small>Time: ${f.timestamp ? f.timestamp.toFixed(2) : 'N/A'}s, RPM: ${f.rpm ? f.rpm.toFixed(0) : 'N/A'}, Value: ${f.value !== undefined ? f.value.toFixed(2) : 'N/A'}</small>`;
        ul.appendChild(li);
      });
      group.appendChild(ul);
      container.appendChild(group);
    };

    renderGroup('UGLY', ugly, 'ugly');
    renderGroup('BAD', bad, 'bad');
    renderGroup('GOOD', good, 'good');
    renderGroup('CANNOT EVALUATE', cannot, 'cannot');
  }

  function renderRecommendations(findings, container) {
    if (!container) return;
    container.innerHTML = '<h3>Recommendations</h3>';

    const critical = findings.filter(f => f.severity === 'ugly' || f.severity === 'bad');
    
    if (critical.length === 0) {
      container.innerHTML += '<p>No issues detected in this session — nothing to recommend.</p>';
      return;
    }

    const ul = document.createElement('ul');
    critical.forEach(f => {
      const li = document.createElement('li');
      li.innerHTML = `Based on <strong>${escapeHtml(f.label)}</strong> (${escapeHtml(f.message)}): Review your setup or tune to address this ${f.severity} finding.`;
      ul.appendChild(li);
    });
    container.appendChild(ul);
  }

  function renderCompare(session1, session2, findings1, findings2, container) {
    if (!container) return;
    // Basic compare implementation
    container.innerHTML = `
      <div class="compare-grid">
        <div class="compare-col">
          <h3>${escapeHtml(session1.filename)}</h3>
          <p>Max RPM: ${session1.stats.maxRpm ? session1.stats.maxRpm.toFixed(0) : 'N/A'}</p>
          <p>Max Boost: ${session1.stats.maxBoost ? session1.stats.maxBoost.toFixed(2) : 'N/A'}</p>
        </div>
        <div class="compare-col">
          <h3>${escapeHtml(session2.filename)}</h3>
          <p>Max RPM: ${session2.stats.maxRpm ? session2.stats.maxRpm.toFixed(0) : 'N/A'}</p>
          <p>Max Boost: ${session2.stats.maxBoost ? session2.stats.maxBoost.toFixed(2) : 'N/A'}</p>
        </div>
      </div>
    `;
  }

  function renderStorageStats(estimate, container) {
    if (!container || !estimate) return;
    const usageMB = (estimate.usage / (1024 * 1024)).toFixed(2);
    const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(2);
    const pct = ((estimate.usage / estimate.quota) * 100).toFixed(1);
    container.innerHTML = `Storage: ${usageMB} MB / ${quotaMB} MB (${pct}%)`;
  }

  function showView(viewName) {
    const views = ['view-home', 'view-session', 'view-compare'];
    views.forEach(v => {
      const el = document.getElementById(v);
      if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.classList.remove('hidden');
    }
  }

  function showDeleteAllModal(onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal-content';
    modal.innerHTML = `
      <h3>Delete All Sessions?</h3>
      <p>Type "DELETE ALL" to confirm.</p>
      <input type="text" id="delete-all-input" />
      <div class="modal-actions">
        <button id="cancel-delete">Cancel</button>
        <button id="confirm-delete" disabled>Delete All</button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const input = modal.querySelector('#delete-all-input');
    const confirmBtn = modal.querySelector('#confirm-delete');
    
    input.addEventListener('input', (e) => {
      confirmBtn.disabled = e.target.value !== 'DELETE ALL';
    });
    
    modal.querySelector('#cancel-delete').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
    
    confirmBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      onConfirm();
    });
  }

  function renderExportButtons(session, rawText, findings, container) {
    if (!container) return;
    container.innerHTML = '';
    
    const csvBtn = document.createElement('button');
    csvBtn.textContent = 'Export CSV';
    csvBtn.addEventListener('click', () => {
      const blob = new Blob([rawText], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = session.filename;
      a.click();
      URL.revokeObjectURL(url);
    });
    container.appendChild(csvBtn);
    
    const reportBtn = document.createElement('button');
    reportBtn.textContent = 'Export Report';
    reportBtn.addEventListener('click', () => {
      const stats = session.stats || {};
      
      const formatFindings = (sev) => {
        const filtered = findings.filter(f => f.severity === sev);
        if (filtered.length === 0) return '- None\n';
        return filtered.map(f => `- **${f.label}**: ${f.message} (Time: ${f.timestamp ? f.timestamp.toFixed(2) : 'N/A'}s, RPM: ${f.rpm ? f.rpm.toFixed(0) : 'N/A'})`).join('\n') + '\n';
      };
      
      const critical = findings.filter(f => f.severity === 'ugly' || f.severity === 'bad');
      const recs = critical.length > 0 
        ? critical.map(f => `- Based on **${f.label}**: Review your setup or tune to address this ${f.severity} finding.`).join('\n')
        : 'No issues detected in this session — nothing to recommend.';

      const markdown = `# AP Log Analysis Report
**File:** ${session.filename}  
**Tune:** ${session.tuneName || 'Unknown'}  
**Date:** ${new Date(session.loadedAt).toLocaleString()}  
**Duration:** ${session.durationSec ? session.durationSec.toFixed(2) : 'N/A'}s  

## Summary
- Max RPM: ${stats.maxRpm ? stats.maxRpm.toFixed(0) : 'N/A'}
- Max Boost: ${stats.maxBoost ? stats.maxBoost.toFixed(2) : 'N/A'} psi
- Ethanol: ${stats.ethanolPct !== undefined && stats.ethanolPct !== null ? stats.ethanolPct.toFixed(1) : 'N/A'}%

## Findings

### 🚨 UGLY — Act Before Next Drive
${formatFindings('ugly')}
### ⚠️ BAD — Investigate
${formatFindings('bad')}
### ✅ GOOD
${formatFindings('good')}
### ℹ️ Cannot Evaluate
${formatFindings('cannot_evaluate')}
## Recommendations
${recs}

---
*Generated by AP Log Analyzer. All data stays on your device.*`;
      
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${session.filename.replace('.csv', '')}.md`;
      a.click();
      URL.revokeObjectURL(url);
    });
    container.appendChild(reportBtn);
  }

  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

  return {
    showToast,
    renderSessionList,
    renderEmptyState,
    renderParseSummary,
    renderSessionHeader,
    renderPullList,
    renderFindings,
    renderRecommendations,
    renderCompare,
    renderStorageStats,
    showView,
    showDeleteAllModal,
    renderExportButtons
  };
})();
