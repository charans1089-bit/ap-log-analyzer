'use strict';

function computeMetrics(session) {
  const { rows } = session;
  if (!rows || rows.length === 0) {
    session.pulls = [];
    session.stats = getEmptyStats();
    return session;
  }

  // Detect pulls
  const pulls = [];
  let inPull = false;
  let pullStartIdx = -1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const throttle = row.throttle_pos;
    const boost = row.boost;
    const rpm = row.rpm;

    const isHighThrottle = throttle > 90;
    const isPositiveBoost = boost > 0;
    const isHighRpm = rpm >= 2500;

    if (!inPull) {
      if (isHighThrottle && isPositiveBoost && isHighRpm) {
        inPull = true;
        pullStartIdx = i;
      }
    } else {
      // End conditions: throttle drops below 85, boost drops <= 0
      const endConditionsMet = throttle < 85 || boost <= 0;
      
      // Additional RPM peak drop check could be added here, but evaluating post-hoc is easier
      if (endConditionsMet || i === rows.length - 1) {
        // Evaluate pull
        const endIdx = i - (endConditionsMet ? 1 : 0);
        if (endIdx > pullStartIdx) {
          const duration = rows[endIdx].time - rows[pullStartIdx].time;
          const startRpm = rows[pullStartIdx].rpm;
          
          let peakRpm = -Infinity;
          let peakBoost = -Infinity;
          let peakLoad = -Infinity;
          
          for (let p = pullStartIdx; p <= endIdx; p++) {
            if (rows[p].rpm > peakRpm) peakRpm = rows[p].rpm;
            if (rows[p].boost > peakBoost) peakBoost = rows[p].boost;
            if (rows[p].calc_load > peakLoad) peakLoad = rows[p].calc_load;
          }

          if (duration >= 0.5 && (peakRpm - startRpm) >= 500) {
            pulls.push({
              index: pulls.length + 1,
              startIdx: pullStartIdx,
              endIdx: endIdx,
              startTime: rows[pullStartIdx].time,
              endTime: rows[endIdx].time,
              durationSec: duration,
              startRpm,
              peakRpm,
              peakBoost,
              peakLoad
            });
          }
        }
        
        inPull = false;
        pullStartIdx = -1;
      }
    }
  }

  // Refine RPM drop within pull detection
  // We can filter pulls where RPM peaks and drops by more than 500 before end of pull, truncating them.
  pulls.forEach(pull => {
    let currentMax = -Infinity;
    for (let p = pull.startIdx; p <= pull.endIdx; p++) {
      const rpm = rows[p].rpm;
      if (rpm > currentMax) currentMax = rpm;
      if (currentMax - rpm > 500) {
        // Truncate pull at this index
        pull.endIdx = p - 1;
        pull.endTime = rows[pull.endIdx].time;
        pull.durationSec = pull.endTime - pull.startTime;
        break;
      }
    }
  });

  // Re-evaluate valid pulls after truncation
  const validPulls = pulls.filter(p => p.durationSec >= 0.5 && (p.peakRpm - p.startRpm) >= 500);

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
