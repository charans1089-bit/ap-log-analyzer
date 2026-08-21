'use strict';

/**
 * AI & Smart Diagnostic Analyzer for Subaru FA24 / Cobb AccessPort Logs
 */
window.AIAnalyzer = (function () {

  /**
   * Calculates overall Engine Safety Score (0 - 100) and categorizes findings into Good, Better, Worst.
   */
  function analyzeSession(session) {
    const findings = session.findings || [];
    const stats = session.stats || {};
    const pulls = session.pulls || [];
    const rows = session.rows || [];

    // Categorize
    const goodItems = [];
    const betterItems = [];
    const worstItems = [];

    // Evaluate findings
    findings.forEach(f => {
      if (f.severity === 'good') {
        goodItems.push({
          title: f.label,
          desc: f.message,
          metric: f.metric,
          value: f.value,
          time: f.timestamp,
          rpm: f.rpm,
          pull: f.pullIndex
        });
      } else if (f.severity === 'bad') {
        betterItems.push({
          title: f.label,
          desc: f.message,
          metric: f.metric,
          value: f.value,
          time: f.timestamp,
          rpm: f.rpm,
          pull: f.pullIndex,
          action: getActionForFinding(f)
        });
      } else if (f.severity === 'ugly') {
        worstItems.push({
          title: f.label,
          desc: f.message,
          metric: f.metric,
          value: f.value,
          time: f.timestamp,
          rpm: f.rpm,
          pull: f.pullIndex,
          action: getActionForFinding(f)
        });
      }
    });

    // Compute Health Score (0 - 100)
    let score = 100;
    
    // Penalties for Ugly / Critical
    worstItems.forEach(item => {
      if (item.metric === 'dam') score -= 35;
      else if (item.metric === 'feedback_knock') score -= 25;
      else if (item.metric === 'fine_knock_learn') score -= 20;
      else if (item.metric === 'afr') score -= 30;
      else if (item.metric === 'inj_duty_cycle') score -= 20;
      else score -= 15;
    });

    // Penalties for Bad / Warnings
    betterItems.forEach(item => {
      if (item.metric === 'feedback_knock') score -= 8;
      else if (item.metric === 'af_learning_1') score -= 10;
      else if (item.metric === 'boost') score -= 10;
      else if (item.metric === 'fuel_press') score -= 12;
      else if (item.metric === 'intake_temp') score -= 6;
      else if (item.metric === 'oil_temp') score -= 8;
      else if (item.metric && item.metric.startsWith('roughness')) score -= 10;
      else score -= 5;
    });

    score = Math.max(10, Math.min(100, Math.round(score)));

    // Synthesis & Recommendations
    const recommendations = generateTunerRecommendations(session, goodItems, betterItems, worstItems);
    const executiveSummary = generateExecutiveSummary(session, score, goodItems, betterItems, worstItems);

    return {
      score,
      healthGrade: getHealthGrade(score),
      good: goodItems,
      better: betterItems,
      worst: worstItems,
      recommendations,
      summary: executiveSummary
    };
  }

  function getHealthGrade(score) {
    if (score >= 90) return { grade: 'A+', text: 'Optimal / Safe', color: '#00f5a0' };
    if (score >= 80) return { grade: 'A', text: 'Good Performance', color: '#4e9af1' };
    if (score >= 70) return { grade: 'B', text: 'Minor Concerns', color: '#f6d365' };
    if (score >= 50) return { grade: 'C', text: 'Moderate Risk', color: '#e08840' };
    return { grade: 'F', text: 'Critical Attention Needed', color: '#ff4b72' };
  }

  function getActionForFinding(f) {
    switch (f.ruleId) {
      case 'DAM_BELOW_1':
        return 'Stay out of boost. Refill with high quality 93/94 octane fuel or add ethanol/octane booster. If DAM stays low, log cruising and send to your tuner.';
      case 'FEEDBACK_KNOCK_UGLY':
        return 'High knock retard under boost. Check for bad fuel, false knock (loose heatshield / downpipe rattle), or reduce boost/timing map.';
      case 'FEEDBACK_KNOCK_BAD':
        return 'Minor feedback knock. If occurring during sudden throttle blips or A/C cycling, likely benign. If during WOT pull, monitor FKL table.';
      case 'FINE_KNOCK_LEARN_UGLY':
        return 'ECU has learned timing retard in this RPM/load cell. Request tuner to taper ignition timing or add fuel in this region.';
      case 'AFR_LEAN_UGLY':
        return 'Dangerously lean under boost (>12.5 AFR). Avoid WOT immediately. Check high-pressure fuel pump (HPFP), injector scaling, and intake leaks.';
      case 'INJ_DUTY_UGLY':
        return 'Fuel injectors maxed (>90% IDC). Cap boost or upgrade fuel system before running higher power / ethanol blends.';
      case 'AF_LEARNING_BAD':
        return 'Long term fuel trim exceeds ±10%. Perform boost leak test, smoke test post-MAF intake tract, and clean MAF sensor.';
      case 'BOOST_OVERSHOOT_BAD':
        return 'Boost overshooting target by >2 psi. Check wastegate pre-load, restrictor pills (if equipped), and electronic wastegate (EWG) duty cycles.';
      case 'WG_TRACKING':
        return 'Wastegate actuator position not tracking commanded position. Check electronic wastegate harness and mechanical linkage rod for binding.';
      case 'IAT_BAD':
        return 'High intake air temperatures (>120°F). Intercooler heat soaked. Allow cool-down period or upgrade intercooler.';
      case 'OIL_TEMP_BAD':
        return 'Oil temp exceeded 250°F. Risk of viscosity loss. Install aftermarket oil cooler and allow idle cool-down.';
      case 'FUEL_PRESS_DROP_BAD':
        return 'Direct injection fuel rail pressure dropped under boost. Check in-tank low pressure fuel pump (LPFP) and fuel filter.';
      case 'LUGGING_BAD':
        return 'High engine load at low RPM in high gear. Downshift before applying heavy throttle to prevent LSPI (Low-Speed Pre-Ignition).';
      default:
        return f.message;
    }
  }

  function generateExecutiveSummary(session, score, good, better, worst) {
    const stats = session.stats || {};
    const pulls = session.pulls || [];
    const pullCount = pulls.length;

    let summary = `This datalog contains ${session.rowsParsed || 0} telemetry rows across ${session.durationSec ? session.durationSec.toFixed(1) : 0} seconds of driving with ${pullCount} wide-open-throttle (WOT) pull${pullCount === 1 ? '' : 's'} detected. `;

    if (worst.length > 0) {
      summary += `🚨 Critical risks detected: ${worst.map(w => w.title).join(', ')}. Engine safety score is reduced to ${score}/100. Avoid aggressive driving until resolved. `;
    } else if (better.length > 0) {
      summary += `⚠️ Operating with minor cautions: Engine safety score is ${score}/100. ${better.length} warning(s) flagged (${better.map(b => b.title).join(', ')}). `;
    } else {
      summary += `✅ Clean health score of ${score}/100. DAM remained locked at 1.000, fueling tracked targets smoothly, and no hazardous knock events were recorded. `;
    }

    if (stats.maxBoost) {
      summary += `Peak boost achieved was ${stats.maxBoost.toFixed(1)} psi with maximum engine speed of ${Math.round(stats.maxRpm || 0)} RPM.`;
    }

    return summary;
  }

  function generateTunerRecommendations(session, good, better, worst) {
    const recs = [];
    const stats = session.stats || {};

    if (worst.some(w => w.metric === 'dam' || w.metric === 'feedback_knock' || w.metric === 'fine_knock_learn')) {
      recs.push({
        category: 'Ignition & Octane',
        priority: 'High',
        title: 'Octane Quality / Timing Reduction',
        detail: 'Knock activity detected during the session. Test with higher octane fuel (e.g., E30 blend or 93+ pump) or request a 1-2° timing reduction from your tuner.'
      });
    }

    if (worst.some(w => w.metric === 'afr') || better.some(b => b.metric === 'af_learning_1')) {
      recs.push({
        category: 'Fueling & Intake',
        priority: 'High',
        title: 'Intake Smoke Test & MAF Calibration',
        detail: 'Fuel trims or AFR deviate from targets. Inspect intake coupler clamps, check for unmetered air leaks, and verify MAF scaling.'
      });
    }

    if (better.some(b => b.metric === 'boost' || b.metric === 'wg_pos_actual')) {
      recs.push({
        category: 'Boost Control',
        priority: 'Medium',
        title: 'Wastegate Duty Cycle Calibration',
        detail: 'Boost curve exhibited overshoot or tracking divergence. Adjust electronic wastegate proportional-integral gains in map.'
      });
    }

    if (better.some(b => b.metric === 'intake_temp')) {
      recs.push({
        category: 'Thermals',
        priority: 'Medium',
        title: 'Charge Air Cooling',
        detail: `Intake air temperatures reached ${stats.iatMax ? stats.iatMax.toFixed(0) : 'N/A'}°F. Consider top-mount/front-mount intercooler upgrade or longer cool-down between pulls.`
      });
    }

    if (recs.length === 0) {
      recs.push({
        category: 'General Maintenance',
        priority: 'Low',
        title: 'Tune is Running Optimal',
        detail: 'All logged parameters are well within safe thresholds for the Subaru FA24 platform. Continue periodic logging every oil change.'
      });
    }

    return recs;
  }

  /**
   * Generates a side-by-side comparison analysis between two sessions
   */
  function compareSessions(sessionA, sessionB) {
    const statsA = sessionA.stats || {};
    const statsB = sessionB.stats || {};
    const findingsA = sessionA.findings || [];
    const findingsB = sessionB.findings || [];

    const analysisA = analyzeSession(sessionA);
    const analysisB = analyzeSession(sessionB);

    // Compute key deltas
    const boostA = statsA.maxBoost || 0;
    const boostB = statsB.maxBoost || 0;
    const boostDelta = boostB - boostA;

    const rpmA = statsA.maxRpm || 0;
    const rpmB = statsB.maxRpm || 0;
    const rpmDelta = rpmB - rpmA;

    const iatA = statsA.iatMax || 0;
    const iatB = statsB.iatMax || 0;
    const iatDelta = iatB - iatA;

    const uglyA = findingsA.filter(f => f.severity === 'ugly').length;
    const uglyB = findingsB.filter(f => f.severity === 'ugly').length;

    const badA = findingsA.filter(f => f.severity === 'bad').length;
    const badB = findingsB.filter(f => f.severity === 'bad').length;

    let verdict = '';
    let winner = 'tie';

    if (analysisB.score > analysisA.score + 5) {
      winner = 'B';
      verdict = `🏆 Session B (${sessionB.filename}) performed noticeably better with a safety score of ${analysisB.score}/100 vs ${analysisA.score}/100 for Session A. It had fewer knock/trim anomalies.`;
    } else if (analysisA.score > analysisB.score + 5) {
      winner = 'A';
      verdict = `🏆 Session A (${sessionA.filename}) was cleaner and safer with a score of ${analysisA.score}/100 compared to ${analysisB.score}/100 for Session B.`;
    } else {
      verdict = `⚖️ Both sessions show comparable engine health (Score A: ${analysisA.score}/100, Score B: ${analysisB.score}/100). `;
      if (boostDelta > 0.5) {
        verdict += `Session B achieved +${boostDelta.toFixed(1)} psi higher peak boost.`;
      } else if (boostDelta < -0.5) {
        verdict += `Session A achieved +${Math.abs(boostDelta).toFixed(1)} psi higher peak boost.`;
      }
    }

    return {
      analysisA,
      analysisB,
      scoreA: analysisA.score,
      scoreB: analysisB.score,
      winner,
      verdict,
      metrics: [
        { label: 'Peak Boost', valA: `${boostA.toFixed(1)} psi`, valB: `${boostB.toFixed(1)} psi`, delta: `${boostDelta >= 0 ? '+' : ''}${boostDelta.toFixed(1)} psi`, status: boostDelta >= 0 ? 'good' : 'bad' },
        { label: 'Max RPM', valA: `${Math.round(rpmA)}`, valB: `${Math.round(rpmB)}`, delta: `${rpmDelta >= 0 ? '+' : ''}${Math.round(rpmDelta)}`, status: 'neutral' },
        { label: 'Max IAT', valA: `${iatA.toFixed(0)}°F`, valB: `${iatB.toFixed(0)}°F`, delta: `${iatDelta >= 0 ? '+' : ''}${iatDelta.toFixed(0)}°F`, status: iatDelta <= 0 ? 'good' : 'bad' },
        { label: 'Critical (Ugly) Findings', valA: uglyA, valB: uglyB, delta: `${uglyB - uglyA}`, status: uglyB <= uglyA ? 'good' : 'bad' },
        { label: 'Warnings (Bad) Findings', valA: badA, valB: badB, delta: `${badB - badA}`, status: badB <= badA ? 'good' : 'bad' },
        { label: 'WOT Pulls Detected', valA: (sessionA.pulls || []).length, valB: (sessionB.pulls || []).length, delta: `${(sessionB.pulls || []).length - (sessionA.pulls || []).length}`, status: 'neutral' }
      ]
    };
  }

  /**
   * Generates an MCP / LLM Prompt package for external AI tools or clipboard export
   */
  function generateMCPPrompt(session) {
    const analysis = analyzeSession(session);
    const stats = session.stats || {};
    const pulls = session.pulls || [];

    const promptObj = {
      role: 'Subaru FA24 Pro Tuner AI Diagnostic Specialist',
      datalog_meta: {
        filename: session.filename,
        tune: session.tuneName || 'Unknown',
        duration_seconds: session.durationSec ? session.durationSec.toFixed(2) : 0,
        pull_count: pulls.length,
        engine_health_score: `${analysis.score}/100 (${analysis.healthGrade.grade})`
      },
      stats: {
        max_rpm: stats.maxRpm,
        max_boost_psi: stats.maxBoost,
        peak_calculated_load: stats.peakLoad,
        ethanol_percent: stats.ethanolPct,
        intake_temp_range: [stats.iatMin, stats.iatMax],
        oil_temp_range: [stats.oilTempMin, stats.oilTempMax]
      },
      critical_ugly_findings: analysis.worst,
      warnings_better_findings: analysis.better,
      good_parameters: analysis.good,
      tuner_recommendations: analysis.recommendations,
      prompt_instructions: "Analyze the above Cobb AccessPort FA24 log telemetry. Detail the ignition timing curve, AFR closed-loop/open-loop transition, boost solenoid response, and deliver specific tune revision advice."
    };

    return JSON.stringify(promptObj, null, 2);
  }

  /**
   * Instant rule-based Q&A answer generator for the interactive AI Ask console
   */
  function answerQuestion(session, query) {
    const q = (query || '').toLowerCase();
    const stats = session.stats || {};
    const findings = session.findings || [];
    const pulls = session.pulls || [];

    if (q.includes('knock') || q.includes('fbk') || q.includes('fkl') || q.includes('dam')) {
      const damFinding = findings.find(f => f.ruleId === 'DAM_BELOW_1');
      const knockFindings = findings.filter(f => f.metric === 'feedback_knock' || f.metric === 'fine_knock_learn');
      if (damFinding) {
        return `🚨 DAM dropped below 1.0: ${damFinding.message}. The ECU lowered global timing multiplier due to persistent knock. Check octane level immediately.`;
      }
      if (knockFindings.length > 0) {
        return `⚠️ Knock activity was logged: ${knockFindings.map(k => `${k.label} (${k.value}°)`).join(', ')}. If this happened during cruising, it may be false knock (A/C clutch or engine accessory). If during WOT pull, fuel octane or ignition timing needs adjustment.`;
      }
      return `✅ Zero concerning knock events logged: DAM remained at 1.000 and feedback knock stayed within safe boundaries throughout the entire log.`;
    }

    if (q.includes('boost') || q.includes('wastegate') || q.includes('psi') || q.includes('overboost')) {
      const peak = stats.maxBoost ? stats.maxBoost.toFixed(1) : 'N/A';
      const boostFindings = findings.filter(f => f.metric === 'boost' || f.metric === 'wg_pos_actual');
      if (boostFindings.length > 0) {
        return `⚠️ Peak boost was ${peak} psi. Note: ${boostFindings.map(b => b.message).join(' | ')}`;
      }
      return `✅ Peak boost reached ${peak} psi. Boost control followed targets smoothly across all ${pulls.length} pull(s) without significant overshoot.`;
    }

    if (q.includes('fuel') || q.includes('afr') || q.includes('trim') || q.includes('lean')) {
      const afrFindings = findings.filter(f => f.metric === 'afr' || f.metric === 'af_learning_1' || f.metric === 'fuel_press');
      if (afrFindings.length > 0) {
        return `⚠️ Fueling diagnostics: ${afrFindings.map(a => `${a.label}: ${a.message}`).join(' | ')}`;
      }
      return `✅ Fueling was on target. Air/Fuel ratio tracked commanded targets properly during high load and fuel rail pressure remained stable.`;
    }

    if (q.includes('temp') || q.includes('iat') || q.includes('oil') || q.includes('heat')) {
      return `🌡️ Thermals: Intake Temp was ${stats.iatMin ? stats.iatMin.toFixed(0) : 'N/A'}°F – ${stats.iatMax ? stats.iatMax.toFixed(0) : 'N/A'}°F; Oil Temp was ${stats.oilTempMin ? stats.oilTempMin.toFixed(0) : 'N/A'}°F – ${stats.oilTempMax ? stats.oilTempMax.toFixed(0) : 'N/A'}°F.`;
    }

    if (q.includes('pull') || q.includes('wot')) {
      if (pulls.length === 0) {
        return `No WOT pulls detected. A pull requires >90% throttle and positive boost for at least 0.5s spanning at least 500 RPM.`;
      }
      return `Detected ${pulls.length} WOT pull(s):\n` + pulls.map(p => `• Pull #${p.index}: ${p.startRpm.toFixed(0)} → ${p.peakRpm.toFixed(0)} RPM, Peak Boost: ${p.peakBoost.toFixed(1)} psi (${p.durationSec.toFixed(2)}s)`).join('\n');
    }

    // Default overview
    const analysis = analyzeSession(session);
    return `📊 Session Overview for ${session.filename}:\n` +
           `• Engine Safety Score: ${analysis.score}/100 (${analysis.healthGrade.grade})\n` +
           `• Max Boost: ${stats.maxBoost ? stats.maxBoost.toFixed(1) : 'N/A'} psi | Max RPM: ${Math.round(stats.maxRpm || 0)}\n` +
           `• Critical Issues: ${analysis.worst.length} | Cautions: ${analysis.better.length} | Clean Checks: ${analysis.good.length}\n` +
           `• ${analysis.summary}`;
  }

  return {
    analyzeSession,
    compareSessions,
    generateMCPPrompt,
    answerQuestion
  };

})();

