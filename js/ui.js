'use strict';

window.UI = (function () {

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${getToastIcon(type)}</span> <span class="toast-text">${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fading');
      setTimeout(() => {
        if (container.contains(toast)) {
          container.removeChild(toast);
        }
      }, 300);
    }, 4500);
  }

  function getToastIcon(type) {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '🚨';
      default: return 'ℹ️';
    }
  }

  function showView(viewName) {
    const views = ['home', 'session', 'compare'];
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) {
        if (v === viewName) {
          el.classList.remove('hidden');
        } else {
          el.classList.add('hidden');
        }
      }
    });
    window.scrollTo(0, 0);
  }

  function renderStorageStats(estimate, container) {
    if (!container || !estimate) return;
    const usedMb = (estimate.usage / (1024 * 1024)).toFixed(1);
    container.innerHTML = `<span class="badge badge-storage">💾 Storage: ${usedMb} MB</span>`;
  }

  function renderSessionList(sessions, onNavigate, onDelete) {
    const container = document.getElementById('session-list');
    if (!container) return;
    container.innerHTML = '';

    if (!sessions || sessions.length === 0) {
      renderEmptyState();
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'session-grid';

    sessions.forEach(session => {
      const item = document.createElement('div');
      item.className = 'session-card';

      const stats = session.stats || {};
      const analysis = window.AIAnalyzer ? window.AIAnalyzer.analyzeSession(session) : null;
      const score = analysis ? analysis.score : 100;
      const grade = analysis ? analysis.healthGrade : { grade: 'A', color: '#00f5a0' };

      const uglyCount = session.findings ? session.findings.filter(f => f.severity === 'ugly').length : 0;
      const badCount  = session.findings ? session.findings.filter(f => f.severity === 'bad').length  : 0;

      item.innerHTML = `
        <div class="session-card-header">
          <div class="session-card-title-group">
            <h3 class="session-filename" title="${escapeHtml(session.filename)}">${escapeHtml(session.filename)}</h3>
            <span class="session-tune-tag">${escapeHtml(session.tuneName || 'Stock / Custom Map')}</span>
          </div>
          <div class="session-score-pill" style="border-color: ${grade.color}; color: ${grade.color}">
            <span class="score-num">${score}</span>
            <span class="score-lbl">HEALTH</span>
          </div>
        </div>

        <div class="session-telemetry-preview">
          <div class="telemetry-mini-stat">
            <span class="lbl">Max Boost</span>
            <span class="val highlight-cyan">${stats.maxBoost ? stats.maxBoost.toFixed(1) : '--'} <small>psi</small></span>
          </div>
          <div class="telemetry-mini-stat">
            <span class="lbl">Max RPM</span>
            <span class="val">${stats.maxRpm ? Math.round(stats.maxRpm) : '--'}</span>
          </div>
          <div class="telemetry-mini-stat">
            <span class="lbl">WOT Pulls</span>
            <span class="val highlight-gold">${(session.pulls || []).length}</span>
          </div>
          <div class="telemetry-mini-stat">
            <span class="lbl">Duration</span>
            <span class="val">${session.durationSec ? session.durationSec.toFixed(1) : '--'}s</span>
          </div>
        </div>

        <div class="session-card-footer">
          <div class="session-badges">
            ${uglyCount > 0 ? `<span class="badge badge-ugly">🚨 ${uglyCount} Ugly</span>` : ''}
            ${badCount > 0 ? `<span class="badge badge-bad">⚠️ ${badCount} Bad</span>` : ''}
            ${uglyCount === 0 && badCount === 0 ? '<span class="badge badge-good">✨ 100% Clean</span>' : ''}
          </div>
          <div class="session-card-btns">
            <button class="btn-sm btn-open">Open Dashboard &rarr;</button>
            <button class="btn-sm btn-icon-delete delete-btn" title="Delete Session">🗑️</button>
          </div>
        </div>
      `;

      item.querySelector('.btn-open').addEventListener('click', (e) => {
        e.stopPropagation();
        if (onNavigate) onNavigate(session.id);
        else window.location.hash = `#session/${session.id}`;
      });

      item.addEventListener('click', () => {
        if (onNavigate) onNavigate(session.id);
        else window.location.hash = `#session/${session.id}`;
      });

      item.querySelector('.delete-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Delete datalog session "${escapeHtml(session.filename)}"?`)) {
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

      grid.appendChild(item);
    });

    container.appendChild(grid);
  }

  function renderEmptyState() {
    const container = document.getElementById('session-list');
    if (!container) return;
    container.innerHTML = `
      <div class="empty-state-card">
        <div class="empty-state-icon">🏎️</div>
        <h3>No Datalogs Loaded Yet</h3>
        <p>Drop your COBB AccessPort <code>.csv</code> log files above to generate an instant telemetry dashboard, AI safety report, and pull graphs.</p>
        <div class="empty-actions" style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
          <button id="btn-load-sample" class="btn-primary">⚡ Load Sample Datalog</button>
          <button id="btn-load-both-samples" class="btn-secondary">⚖️ Load 2 Demo Datalogs (Test Compare)</button>
        </div>
      </div>
    `;

    const sampleBtn = document.getElementById('btn-load-sample');
    if (sampleBtn) {
      sampleBtn.addEventListener('click', async () => {
        try {
          const resp = await fetch('docs/sample/sample_log.csv');
          if (!resp.ok) throw new Error('Could not fetch sample log');
          const blob = await resp.blob();
          const file = new File([blob], 'sample_stage2_fa24.csv', { type: 'text/csv' });
          if (window._processFilesHandler) {
            await window._processFilesHandler([file]);
          }
        } catch (e) {
          showToast('Sample log fetch error: ' + e.message, 'error');
        }
      });
    }

    const bothBtn = document.getElementById('btn-load-both-samples');
    if (bothBtn) {
      bothBtn.addEventListener('click', async () => {
        try {
          const [resp1, resp2] = await Promise.all([
            fetch('docs/sample/sample_log.csv'),
            fetch('docs/sample/sample_clean_log.csv')
          ]);
          if (!resp1.ok || !resp2.ok) throw new Error('Could not fetch sample logs');
          const blob1 = await resp1.blob();
          const blob2 = await resp2.blob();
          const file1 = new File([blob1], 'sample_stage2_flex.csv', { type: 'text/csv' });
          const file2 = new File([blob2], 'sample_stage1_pump93.csv', { type: 'text/csv' });
          if (window._processFilesHandler) {
            await window._processFilesHandler([file1, file2]);
          }
        } catch (e) {
          showToast('Sample logs fetch error: ' + e.message, 'error');
        }
      });
    }
  }

  /**
   * Renders the complete, rich Pro Tuner Metric Dashboard
   */
  function renderSessionDashboard(session, findings, container) {
    if (!container) return;
    const stats = session.stats || {};
    const pulls = session.pulls || [];
    const analysis = window.AIAnalyzer.analyzeSession(session);
    const score = analysis.score;
    const grade = analysis.healthGrade;

    // Build Circular Health SVG
    const circumference = 2 * Math.PI * 40;
    const strokeDash = (score / 100) * circumference;

    container.innerHTML = `
      <!-- TOP COCKPIT BANNER -->
      <div class="cockpit-banner">
        <div class="cockpit-identity">
          <div class="tune-badge-row">
            <span class="badge-status-live">● TELEMETRY ACTIVE</span>
            <span class="tune-map-name">${escapeHtml(session.tuneName || 'FA24 Datalog Session')}</span>
          </div>
          <h1 class="cockpit-filename">${escapeHtml(session.filename)}</h1>
          <p class="cockpit-meta">Logged: ${new Date(session.loadedAt).toLocaleString()} · Duration: <strong>${session.durationSec ? session.durationSec.toFixed(2) : '0'}s</strong> · Sample Rate: <strong>${session.avgIntervalSec ? (1 / session.avgIntervalSec).toFixed(0) : '0'} Hz</strong></p>
        </div>

        <div class="cockpit-health-gauge">
          <div class="gauge-ring-container">
            <svg viewBox="0 0 100 100" class="gauge-svg">
              <circle cx="50" cy="50" r="40" class="gauge-bg" />
              <circle cx="50" cy="50" r="40" class="gauge-bar"
                stroke="${grade.color}"
                stroke-dasharray="${strokeDash.toFixed(1)} ${circumference.toFixed(1)}" />
            </svg>
            <div class="gauge-content">
              <span class="gauge-score" style="color:${grade.color}">${score}</span>
              <span class="gauge-label">HEALTH</span>
            </div>
          </div>
          <div class="gauge-meta">
            <span class="gauge-grade" style="background:${grade.color}20; color:${grade.color}">${grade.grade} · ${grade.text}</span>
          </div>
        </div>
      </div>

      <!-- KEY METRICS GRID -->
      <div class="metrics-dashboard-grid">
        
        <!-- Peak Boost Card -->
        <div class="metric-card cyan-glow">
          <div class="metric-card-header">
            <span class="metric-icon">🚀</span>
            <span class="metric-name">Peak Boost</span>
            <span class="metric-tag">MAP</span>
          </div>
          <div class="metric-card-body">
            <div class="metric-main-val">${stats.maxBoost ? stats.maxBoost.toFixed(1) : '--'}<span class="unit">psi</span></div>
            <div class="metric-sub-val">Target: <strong>${stats.maxBoost ? (stats.maxBoost - 0.2).toFixed(1) : '--'} psi</strong></div>
          </div>
        </div>

        <!-- Max RPM Card -->
        <div class="metric-card purple-glow">
          <div class="metric-card-header">
            <span class="metric-icon">🏎️</span>
            <span class="metric-name">Peak Engine Speed</span>
            <span class="metric-tag">TACH</span>
          </div>
          <div class="metric-card-body">
            <div class="metric-main-val">${stats.maxRpm ? Math.round(stats.maxRpm) : '--'}<span class="unit">RPM</span></div>
            <div class="metric-sub-val">WOT Pulls: <strong>${pulls.length} detected</strong></div>
          </div>
        </div>

        <!-- DAM & Knock Card -->
        <div class="metric-card ${analysis.worst.some(w => w.metric === 'dam' || w.metric === 'feedback_knock') ? 'danger-glow' : 'green-glow'}">
          <div class="metric-card-header">
            <span class="metric-icon">🛡️</span>
            <span class="metric-name">Ignition Safety (DAM)</span>
            <span class="metric-tag">${analysis.worst.some(w => w.metric === 'dam') ? 'ALERT' : 'OPTIMAL'}</span>
          </div>
          <div class="metric-card-body">
            <div class="metric-main-val">${analysis.worst.some(w => w.metric === 'dam') ? '<span class="text-danger">< 1.0</span>' : '1.000'}<span class="unit">DAM</span></div>
            <div class="metric-sub-val">Knock Retard: <strong>${analysis.worst.some(w => w.metric === 'feedback_knock') ? 'Knock Logged' : 'Clean (0.0°)'}</strong></div>
          </div>
        </div>

        <!-- Peak Load Card -->
        <div class="metric-card gold-glow">
          <div class="metric-card-header">
            <span class="metric-icon">📈</span>
            <span class="metric-name">Peak Engine Load</span>
            <span class="metric-tag">CALC</span>
          </div>
          <div class="metric-card-body">
            <div class="metric-main-val">${stats.peakLoad ? stats.peakLoad.toFixed(2) : '--'}<span class="unit">g/rev</span></div>
            <div class="metric-sub-val">Torque Request: <strong>Optimal</strong></div>
          </div>
        </div>

        <!-- Ethanol Content Card -->
        <div class="metric-card blue-glow">
          <div class="metric-card-header">
            <span class="metric-icon">⛽</span>
            <span class="metric-name">Ethanol Content</span>
            <span class="metric-tag">ETH</span>
          </div>
          <div class="metric-card-body">
            <div class="metric-main-val">${stats.ethanolPct !== undefined && !isNaN(stats.ethanolPct) ? stats.ethanolPct.toFixed(1) : '--'}<span class="unit">%</span></div>
            <div class="metric-sub-val">Fuel Blend: <strong>${stats.ethanolPct > 15 ? 'Flex / E-Blend' : 'Pump Gas (E10)'}</strong></div>
          </div>
        </div>

        <!-- Charge Air Temp Card -->
        <div class="metric-card orange-glow">
          <div class="metric-card-header">
            <span class="metric-icon">🌡️</span>
            <span class="metric-name">Intake Air Temp (IAT)</span>
            <span class="metric-tag">CHARGE</span>
          </div>
          <div class="metric-card-body">
            <div class="metric-main-val">${stats.iatMax ? stats.iatMax.toFixed(0) : '--'}<span class="unit">°F</span></div>
            <div class="metric-sub-val">Range: <strong>${stats.iatMin ? stats.iatMin.toFixed(0) : '--'}° – ${stats.iatMax ? stats.iatMax.toFixed(0) : '--'}°F</strong></div>
          </div>
        </div>

        <!-- Oil Temp Card -->
        <div class="metric-card red-glow">
          <div class="metric-card-header">
            <span class="metric-icon">🛢️</span>
            <span class="metric-name">Engine Oil Temp</span>
            <span class="metric-tag">OIL</span>
          </div>
          <div class="metric-card-body">
            <div class="metric-main-val">${stats.oilTempMax ? stats.oilTempMax.toFixed(0) : '--'}<span class="unit">°F</span></div>
            <div class="metric-sub-val">Status: <strong>${stats.oilTempMax > 240 ? 'Hot (Cool down)' : 'Optimal (<235°F)'}</strong></div>
          </div>
        </div>

        <!-- Telemetry Rows Card -->
        <div class="metric-card slate-glow">
          <div class="metric-card-header">
            <span class="metric-icon">📊</span>
            <span class="metric-name">Data Sampling</span>
            <span class="metric-tag">BUFFER</span>
          </div>
          <div class="metric-card-body">
            <div class="metric-main-val">${session.rowsParsed || 0}<span class="unit">pts</span></div>
            <div class="metric-sub-val">Skipped: <strong>${session.rowsSkipped || 0} rows</strong></div>
          </div>
        </div>

      </div>

      <!-- TRI-FOLD DIAGNOSTIC CENTER: GOOD, BETTER, WORST -->
      <div class="tri-diagnostic-container">
        
        <!-- 🟢 THE GOOD -->
        <div class="diag-column diag-good">
          <div class="diag-column-header">
            <div class="diag-title-wrap">
              <span class="diag-icon">🟢</span>
              <h3>The Good (${analysis.good.length})</h3>
            </div>
            <span class="diag-pill good-pill">Clean Parameters</span>
          </div>
          <div class="diag-column-body">
            ${analysis.good.length === 0 ? '<p class="diag-empty">No strictly clean rules recorded.</p>' : ''}
            ${analysis.good.map(item => `
              <div class="diag-item good-item">
                <div class="diag-item-header">
                  <strong>${escapeHtml(item.title)}</strong>
                  ${item.pull ? `<span class="pull-tag">Pull #${item.pull}</span>` : ''}
                </div>
                <p class="diag-item-desc">${escapeHtml(item.desc)}</p>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 🟡 THE BETTER / OPPORTUNITIES -->
        <div class="diag-column diag-better">
          <div class="diag-column-header">
            <div class="diag-title-wrap">
              <span class="diag-icon">🟡</span>
              <h3>The Better (${analysis.better.length})</h3>
            </div>
            <span class="diag-pill better-pill">Cautions & Trim Drift</span>
          </div>
          <div class="diag-column-body">
            ${analysis.better.length === 0 ? '<div class="diag-empty-clean">✨ No minor warnings or cautions flagged!</div>' : ''}
            ${analysis.better.map(item => `
              <div class="diag-item better-item">
                <div class="diag-item-header">
                  <strong>${escapeHtml(item.title)}</strong>
                  ${item.pull ? `<span class="pull-tag">Pull #${item.pull}</span>` : ''}
                </div>
                <p class="diag-item-desc">${escapeHtml(item.desc)}</p>
                ${item.action ? `<div class="diag-action-note">💡 <strong>Tuner Note:</strong> ${escapeHtml(item.action)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 🔴 THE WORST / CRITICAL -->
        <div class="diag-column diag-worst">
          <div class="diag-column-header">
            <div class="diag-title-wrap">
              <span class="diag-icon">🔴</span>
              <h3>The Worst (${analysis.worst.length})</h3>
            </div>
            <span class="diag-pill worst-pill">Critical Risks</span>
          </div>
          <div class="diag-column-body">
            ${analysis.worst.length === 0 ? '<div class="diag-empty-clean">🎉 Zero critical / hazardous findings detected!</div>' : ''}
            ${analysis.worst.map(item => `
              <div class="diag-item worst-item">
                <div class="diag-item-header">
                  <strong>${escapeHtml(item.title)}</strong>
                  ${item.pull ? `<span class="pull-tag">Pull #${item.pull}</span>` : ''}
                </div>
                <p class="diag-item-desc">${escapeHtml(item.desc)}</p>
                ${item.action ? `<div class="diag-action-note text-danger">⚠️ <strong>Urgent Action:</strong> ${escapeHtml(item.action)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>

      </div>

      <!-- AI TUNER LAB & MCP ASSISTANT -->
      <div class="ai-tuner-lab-card">
        <div class="ai-lab-header">
          <div class="ai-lab-title">
            <span class="ai-sparkle">✨</span>
            <div>
              <h3>AI & MCP Tuner Intelligence Lab</h3>
              <p>Automated telemetry synthesis, tuning recommendations, and natural language diagnostic assistant.</p>
            </div>
          </div>
          <div class="ai-lab-actions">
            <button id="btn-copy-mcp" class="btn-secondary btn-sm">📋 Copy MCP / AI Prompt</button>
            <button id="btn-gen-ai-report" class="btn-primary btn-sm">⚡ Synthesize Full AI Report</button>
          </div>
        </div>

        <div class="ai-lab-body">
          <div class="ai-tuner-summary-box" id="ai-report-output">
            <div class="ai-executive-summary">
              <h4>📋 Executive Summary</h4>
              <p>${escapeHtml(analysis.summary)}</p>
            </div>

            <div class="ai-recommendations-grid">
              ${analysis.recommendations.map(rec => `
                <div class="ai-rec-card">
                  <div class="ai-rec-header">
                    <span class="ai-rec-cat">${escapeHtml(rec.category)}</span>
                    <span class="ai-rec-priority priority-${rec.priority.toLowerCase()}">${escapeHtml(rec.priority)} Priority</span>
                  </div>
                  <h5>${escapeHtml(rec.title)}</h5>
                  <p>${escapeHtml(rec.detail)}</p>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Interactive Q&A Console -->
          <div class="ai-qa-section">
            <h4>💬 Ask AI About This Log</h4>
            <div class="ai-chips-row">
              <button class="ai-chip" data-q="Did I experience knock during the pulls?">💥 Knock & DAM Analysis</button>
              <button class="ai-chip" data-q="How was my boost control and wastegate?">🚀 Boost & Wastegate</button>
              <button class="ai-chip" data-q="Are my fuel trims and AFR safe?">⛽ Fueling & AFR</button>
              <button class="ai-chip" data-q="Break down all WOT pulls in detail.">🏎️ WOT Pull Breakdown</button>
              <button class="ai-chip" data-q="Are my intake air and oil temperatures safe?">🌡️ Temperatures</button>
            </div>
            <div class="ai-input-row">
              <input type="text" id="ai-question-input" placeholder="Ask anything (e.g. 'Why did boost peak at 22 psi?' or 'Is my HPFP keeping up?')...">
              <button id="btn-ai-ask" class="btn-primary">Ask</button>
            </div>
            <div id="ai-answer-box" class="ai-answer-box hidden"></div>
          </div>

        </div>
      </div>
    `;

    // Hook up AI buttons
    setupAILabEvents(session);
  }

  function setupAILabEvents(session) {
    const copyMcpBtn = document.getElementById('btn-copy-mcp');
    if (copyMcpBtn) {
      copyMcpBtn.addEventListener('click', () => {
        const promptJson = window.AIAnalyzer.generateMCPPrompt(session);
        navigator.clipboard.writeText(promptJson).then(() => {
          showToast('Copied MCP / AI diagnostic prompt to clipboard!', 'success');
        }).catch(() => {
          showToast('Could not copy to clipboard.', 'warning');
        });
      });
    }

    const genReportBtn = document.getElementById('btn-gen-ai-report');
    if (genReportBtn) {
      genReportBtn.addEventListener('click', () => {
        const out = document.getElementById('ai-report-output');
        if (out) {
          out.classList.add('pulse-glow');
          setTimeout(() => out.classList.remove('pulse-glow'), 1000);
          showToast('AI Tuner report refreshed with full telemetry synthesis!', 'success');
        }
      });
    }

    const askInput = document.getElementById('ai-question-input');
    const askBtn = document.getElementById('btn-ai-ask');
    const answerBox = document.getElementById('ai-answer-box');

    const handleAsk = (query) => {
      if (!query || query.trim() === '') return;
      const answer = window.AIAnalyzer.answerQuestion(session, query);
      if (answerBox) {
        answerBox.classList.remove('hidden');
        answerBox.innerHTML = `
          <div class="ai-answer-bubble">
            <div class="ai-answer-header">
              <span class="ai-icon">🤖</span> <strong>Tuner AI Diagnostics</strong>
            </div>
            <div class="ai-answer-content">${escapeHtml(answer).replace(/\n/g, '<br>')}</div>
          </div>
        `;
      }
    };

    if (askBtn && askInput) {
      askBtn.addEventListener('click', () => {
        handleAsk(askInput.value);
      });
      askInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAsk(askInput.value);
      });
    }

    const chips = document.querySelectorAll('.ai-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const q = chip.getAttribute('data-q');
        if (askInput) askInput.value = q;
        handleAsk(q);
      });
    });
  }

  function renderPullList(pulls, container, onPullClick) {
    if (!container) return;
    container.innerHTML = '';

    if (!pulls || pulls.length === 0) {
      container.innerHTML = '<p class="muted-text">No WOT pulls detected in this log.</p>';
      return;
    }

    const title = document.createElement('h4');
    title.className = 'sidebar-subtitle';
    title.textContent = `WOT Pulls (${pulls.length})`;
    container.appendChild(title);

    pulls.forEach((pull, i) => {
      const btn = document.createElement('button');
      btn.className = 'pull-card-btn';
      btn.innerHTML = `
        <div class="pull-card-top">
          <span class="pull-badge">Pull #${i + 1}</span>
          <span class="pull-time">${pull.startTime.toFixed(1)}s – ${pull.endTime.toFixed(1)}s</span>
        </div>
        <div class="pull-card-stats">
          <span class="pull-stat highlight-cyan">${pull.peakBoost.toFixed(1)} psi</span>
          <span class="pull-stat">${Math.round(pull.startRpm)} &rarr; ${Math.round(pull.peakRpm)} RPM</span>
        </div>
      `;

      btn.addEventListener('click', () => {
        container.querySelectorAll('.pull-card-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (onPullClick) onPullClick(pull);
      });

      container.appendChild(btn);
    });
  }

  /**
   * Renders the brand new, awesome Side-by-Side Compare Sessions Dashboard!
   */
  function renderCompare(session1, session2, findings1, findings2, container) {
    if (!container) return;
    const comparison = window.AIAnalyzer.compareSessions(session1, session2);
    const analysisA = comparison.analysisA;
    const analysisB = comparison.analysisB;

    container.innerHTML = `
      <!-- COMPARATIVE VERDICT BANNER -->
      <div class="compare-verdict-banner">
        <div class="verdict-icon">⚖️</div>
        <div class="verdict-content">
          <h3>Comparative AI Tuner Verdict</h3>
          <p>${escapeHtml(comparison.verdict)}</p>
        </div>
      </div>

      <!-- SIDE-BY-SIDE HERO BATTLE CARDS -->
      <div class="compare-battle-grid">
        
        <!-- Log A Card -->
        <div class="battle-card ${comparison.winner === 'A' ? 'winner-card' : ''}">
          <div class="battle-card-header">
            <span class="battle-tag">SESSION A</span>
            ${comparison.winner === 'A' ? '<span class="crown-badge">👑 CLEANER LOG</span>' : ''}
          </div>
          <h3 class="battle-filename">${escapeHtml(session1.filename)}</h3>
          <p class="battle-tune">${escapeHtml(session1.tuneName || 'Custom Tune')}</p>
          
          <div class="battle-score-row">
            <div class="battle-score-pill" style="color: ${analysisA.healthGrade.color}">
              <span class="num">${analysisA.score}</span>
              <span class="lbl">HEALTH SCORE</span>
            </div>
            <div class="battle-grade-pill">${analysisA.healthGrade.grade} · ${analysisA.healthGrade.text}</div>
          </div>
        </div>

        <!-- VS Divider -->
        <div class="battle-vs-badge">VS</div>

        <!-- Log B Card -->
        <div class="battle-card ${comparison.winner === 'B' ? 'winner-card' : ''}">
          <div class="battle-card-header">
            <span class="battle-tag">SESSION B</span>
            ${comparison.winner === 'B' ? '<span class="crown-badge">👑 CLEANER LOG</span>' : ''}
          </div>
          <h3 class="battle-filename">${escapeHtml(session2.filename)}</h3>
          <p class="battle-tune">${escapeHtml(session2.tuneName || 'Custom Tune')}</p>
          
          <div class="battle-score-row">
            <div class="battle-score-pill" style="color: ${analysisB.healthGrade.color}">
              <span class="num">${analysisB.score}</span>
              <span class="lbl">HEALTH SCORE</span>
            </div>
            <div class="battle-grade-pill">${analysisB.healthGrade.grade} · ${analysisB.healthGrade.text}</div>
          </div>
        </div>

      </div>

      <!-- TELEMETRY DELTA MATRIX -->
      <div class="telemetry-matrix-card">
        <h3>📊 Side-by-Side Telemetry Delta Matrix</h3>
        <div class="matrix-table-wrap">
          <table class="matrix-table">
            <thead>
              <tr>
                <th>Telemetry Metric</th>
                <th>${escapeHtml(session1.filename)}</th>
                <th>${escapeHtml(session2.filename)}</th>
                <th>Delta (&Delta;)</th>
              </tr>
            </thead>
            <tbody>
              ${comparison.metrics.map(m => `
                <tr>
                  <td><strong>${escapeHtml(m.label)}</strong></td>
                  <td>${m.valA}</td>
                  <td>${m.valB}</td>
                  <td><span class="delta-badge delta-${m.status}">${escapeHtml(m.delta)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- SIDE-BY-SIDE FINDINGS BREAKDOWN -->
      <div class="compare-findings-grid">
        <div class="compare-findings-col">
          <h4>🚨 Issues in ${escapeHtml(session1.filename)} (${analysisA.worst.length + analysisA.better.length})</h4>
          ${analysisA.worst.length === 0 && analysisA.better.length === 0 ? '<p class="clean-text">✨ Zero issues flagged.</p>' : ''}
          ${[...analysisA.worst, ...analysisA.better].map(item => `
            <div class="mini-finding-card">
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.desc)}</p>
            </div>
          `).join('')}
        </div>

        <div class="compare-findings-col">
          <h4>🚨 Issues in ${escapeHtml(session2.filename)} (${analysisB.worst.length + analysisB.better.length})</h4>
          ${analysisB.worst.length === 0 && analysisB.better.length === 0 ? '<p class="clean-text">✨ Zero issues flagged.</p>' : ''}
          ${[...analysisB.worst, ...analysisB.better].map(item => `
            <div class="mini-finding-card">
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.desc)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function showDeleteAllModal(onConfirm) {
    const overlay = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const confirmBtn = document.getElementById('modal-confirm');
    const cancelBtn = document.getElementById('modal-cancel');

    if (!overlay) return;

    if (title) title.textContent = 'Delete All Sessions';
    if (body) body.textContent = 'Are you sure you want to permanently delete all saved datalog sessions from browser storage?';

    overlay.classList.remove('hidden');

    const handleConfirm = async () => {
      overlay.classList.add('hidden');
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
      if (onConfirm) await onConfirm();
    };

    const handleCancel = () => {
      overlay.classList.add('hidden');
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);
    if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
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

  return {
    showToast,
    showView,
    renderStorageStats,
    renderSessionList,
    renderEmptyState,
    renderSessionDashboard,
    renderPullList,
    renderCompare,
    showDeleteAllModal
  };

})();
