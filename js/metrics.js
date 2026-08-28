'use strict';

function computeMetrics(session) {
  const { rows } = session;
  if (!rows || rows.length === 0) {
    session.pulls = [];
    session.stats = getEmptyStats();
    return session;
  }

  // ────────────────────────────────────────────────────────────────────
  // STATE CLASSIFICATION - Foundation for new pull detection
  // ────────────────────────────────────────────────────────────────────
  const states = window.StateClassifier ? window.StateClassifier.classifyAllRows(rows) : [];
  session._states = states;

  // ────────────────────────────────────────────────────────────────────
  // DETECT PULLS - New state-based definition
  // A WOT pull = contiguous SPOOL → WOT_STEADY, minimum 1.0 s in WOT_STEADY,
  // RPM rising monotonically ≥ 800 RPM.
  // ────────────────────────────────────────────────────────────────────
  const pulls = [];
  let inPull = false;
  let pullStartIdx = -1;
  let wotSteadyStartIdx = -1;

  for (let i = 0; i < rows.length; i++) {
    const state = states[i] || 'UNKNOWN';
    const SPOOL = window.StateClassifier?.STATES?.SPOOL || 'SPOOL';
    const WOT_STEADY = window.StateClassifier?.STATES?.WOT_STEADY || 'WOT_STEADY';

    if (!inPull && (state === SPOOL || state === WOT_STEADY)) {
      // Start of potential pull (from SPOOL or direct WOT_STEADY)
      inPull = true;
      pullStartIdx = i;
      wotSteadyStartIdx = (state === WOT_STEADY) ? i : -1;
    } else if (inPull && state === WOT_STEADY && wotSteadyStartIdx === -1) {
      // Transitioned into WOT_STEADY
      wotSteadyStartIdx = i;
    }

    if (inPull && state !== SPOOL && state !== WOT_STEADY) {
      // Pull ended
      if (wotSteadyStartIdx !== -1) {
        // Had SPOOL → WOT_STEADY transition; validate
        const endIdx = i - 1;
        const duration = rows[endIdx].time - rows[wotSteadyStartIdx].time;
        const rpmStart = rows[pullStartIdx].rpm || 0;
        const rpmEnd = rows[endIdx].rpm || 0;
        const rpmSpan = rpmEnd - rpmStart;

        // Validate: WOT_STEADY ≥ 1.0 s and RPM ≥ 800 span
        if (duration >= 1.0 && rpmSpan >= 800) {
          let peakRpm = -Infinity;
          let peakBoost = -Infinity;
          let peakLoad = -Infinity;
          let gear = null;

          for (let p = pullStartIdx; p <= endIdx; p++) {
            if (Number.isFinite(rows[p].rpm) && rows[p].rpm > peakRpm) peakRpm = rows[p].rpm;
            if (Number.isFinite(rows[p].boost) && rows[p].boost > peakBoost) peakBoost = rows[p].boost;
            if (Number.isFinite(rows[p].calc_load) && rows[p].calc_load > peakLoad) peakLoad = rows[p].calc_load;
            if (!gear && Number.isFinite(rows[p].gear)) gear = Math.round(rows[p].gear);
          }

          pulls.push({
            index: pulls.length + 1,
            startIdx: pullStartIdx,
            endIdx: endIdx,
            startTime: rows[pullStartIdx].time,
            endTime: rows[endIdx].time,
            durationSec: endIdx - pullStartIdx > 0 ? rows[endIdx].time - rows[pullStartIdx].time : 0,
            wotSteadyStartIdx,
            wotSteadyDuration: duration,
            startRpm: rpmStart,
            endRpm: rpmEnd,
            rpmSpan,
            peakRpm: Number.isFinite(peakRpm) ? peakRpm : null,
            peakBoost: Number.isFinite(peakBoost) ? peakBoost : null,
            peakLoad: Number.isFinite(peakLoad) ? peakLoad : null,
            gear: Number.isFinite(gear) ? gear : null
          });
        }
      }

      inPull = false;
      pullStartIdx = -1;
      wotSteadyStartIdx = -1;
    }
  }

  // Final pull (if log ends during pull)
  if (inPull && wotSteadyStartIdx !== -1) {
    const endIdx = rows.length - 1;
    const duration = rows[endIdx].time - rows[wotSteadyStartIdx].time;
    const rpmStart = rows[pullStartIdx].rpm || 0;
    const rpmEnd = rows[endIdx].rpm || 0;
    const rpmSpan = rpmEnd - rpmStart;

    if (duration >= 1.0 && rpmSpan >= 800) {
      let peakRpm = -Infinity;
      let peakBoost = -Infinity;
      let peakLoad = -Infinity;
      let gear = null;

      for (let p = pullStartIdx; p <= endIdx; p++) {
        if (Number.isFinite(rows[p].rpm) && rows[p].rpm > peakRpm) peakRpm = rows[p].rpm;
        if (Number.isFinite(rows[p].boost) && rows[p].boost > peakBoost) peakBoost = rows[p].boost;
        if (Number.isFinite(rows[p].calc_load) && rows[p].calc_load > peakLoad) peakLoad = rows[p].calc_load;
        if (!gear && Number.isFinite(rows[p].gear)) gear = Math.round(rows[p].gear);
      }

      pulls.push({
        index: pulls.length + 1,
        startIdx: pullStartIdx,
        endIdx: endIdx,
        startTime: rows[pullStartIdx].time,
        endTime: rows[endIdx].time,
        durationSec: rows[endIdx].time - rows[pullStartIdx].time,
        wotSteadyStartIdx,
        wotSteadyDuration: duration,
        startRpm: rpmStart,
        endRpm: rpmEnd,
        rpmSpan,
        peakRpm: Number.isFinite(peakRpm) ? peakRpm : null,
        peakBoost: Number.isFinite(peakBoost) ? peakBoost : null,
        peakLoad: Number.isFinite(peakLoad) ? peakLoad : null,
        gear: Number.isFinite(gear) ? gear : null
      });
    }
  }

  const validPulls = pulls;

  // Compute stats
  let maxRpm = -Infinity;
  let maxBoost = -Infinity;
  let peakLoadSession = -Infinity;
  let iatMin = Infinity;
  let iatMax = -Infinity;
  let oilTempMin = Infinity;
  let oilTempMax = -Infinity;
  const ethanols = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!isNaN(r.rpm) && r.rpm > maxRpm) maxRpm = r.rpm;
    if (!isNaN(r.boost) && r.boost > maxBoost) maxBoost = r.boost;
    if (!isNaN(r.calc_load) && r.calc_load > peakLoadSession) peakLoadSession = r.calc_load;
    
    if (!isNaN(r.intake_temp)) {
      if (r.intake_temp < iatMin) iatMin = r.intake_temp;
      if (r.intake_temp > iatMax) iatMax = r.intake_temp;
    }
    
    if (!isNaN(r.oil_temp)) {
      if (r.oil_temp < oilTempMin) oilTempMin = r.oil_temp;
      if (r.oil_temp > oilTempMax) oilTempMax = r.oil_temp;
    }
    
    if (!isNaN(r.ethanol_final)) {
      ethanols.push(r.ethanol_final);
    }
  }

  let ethanolPct = NaN;
  if (ethanols.length > 0) {
    ethanols.sort((a, b) => a - b);
    const mid = Math.floor(ethanols.length / 2);
    ethanolPct = ethanols.length % 2 !== 0 ? ethanols[mid] : (ethanols[mid - 1] + ethanols[mid]) / 2;
  }

  session.pulls = validPulls;
  session.stats = {
    maxRpm: maxRpm === -Infinity ? NaN : maxRpm,
    maxBoost: maxBoost === -Infinity ? NaN : maxBoost,
    peakLoad: peakLoadSession === -Infinity ? NaN : peakLoadSession,
    ethanolPct,
    iatMin: iatMin === Infinity ? NaN : iatMin,
    iatMax: iatMax === -Infinity ? NaN : iatMax,
    oilTempMin: oilTempMin === Infinity ? NaN : oilTempMin,
    oilTempMax: oilTempMax === -Infinity ? NaN : oilTempMax
  };

  return session;
}

function getEmptyStats() {
  return {
    maxRpm: NaN, maxBoost: NaN, peakLoad: NaN,
    ethanolPct: NaN, iatMin: NaN, iatMax: NaN,
    oilTempMin: NaN, oilTempMax: NaN
  };
}

window.Metrics = { computeMetrics };
