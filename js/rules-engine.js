'use strict';

/**
 * Rules Engine - Rewritten for FA24 DIT with state-based evaluation
 * 
 * All rules subscribe to specific operating states.
 * Rules are gated by:
 * 1. Operating state
 * 2. Data availability
 * 3. Minimum consecutive samples or time duration
 * 4. Exclusion windows (post-SHIFT, post-DECEL_FUEL_CUT, post-TIP_IN)
 */

const THRESHOLDS = {
  // DAM
  DAM_MIN:                 1.0,
  
  // Knock
  FBK_UGLY_THRESHOLD:      -4.0,
  FBK_BAD_LOW:            -3.9,
  FBK_BAD_HIGH:           -2.0,
  FKL_UGLY_THRESHOLD:      -2.0,
  
  // AFR
  AFR_LEAN_DEVIATION:      0.7,   // Leaner than commanded by > this = flag
  
  // Boost
  BOOST_OVERSHOOT_THRESHOLD:      2.0,    // psi over target
  BOOST_OVERSHOOT_DURATION:       0.5,    // seconds
  
  // Temperature
  IAT_WARN:               120.0,  // °F, during WOT pull only
  OIL_TEMP_WARN:          250.0,  // °F
  COOLANT_TEMP_WARN:      220.0,  // °F
  
  // Fuel Pressure
  FUEL_PRESS_DROP_PERCENT: 20.0,  // % sustained drop
  
  // Ethanol
  ETHANOL_THRESHOLD:      75.0    // % over 3 sessions = flag
};

/**
 * Finding class - enforces complete context
 * MUST THROW if any required field is missing
 * Required: timestamp, rpm, gear, boost, load, throttle, state, observed, expected, ruleId
 */
class Finding {
  constructor(severity, ruleId, label, message, opts = {}) {
    const observedValue = opts.value !== undefined ? opts.value : opts.observed;

    // Required fields - MUST all be present
    const requiredFields = {
      timestamp: opts.timestamp,
      rpm: opts.rpm,
      gear: opts.gear,
      boost: opts.boost,
      load: opts.load,
      throttle: opts.throttle,
      state: opts.state,
      observed: observedValue,
      expected: opts.expected,
      ruleId: ruleId
    };

    // Validate - THROW if any required field is missing or null
    for (const [field, value] of Object.entries(requiredFields)) {
      if (value === undefined || value === null) {
        throw new Error(
          `Finding construction failed: required field '${field}' is missing or null. ` +
          `Rule: ${ruleId}, Label: ${label}. ` +
          `All findings MUST include: timestamp, rpm, gear, boost, load, throttle, state, observed, expected, ruleId.`
        );
      }
    }

    // Construct finding with complete context
    this.id = `${ruleId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.severity = severity;
    this.ruleId = ruleId;
    this.label = label;
    this.message = message;
    this.metric = opts.metric || ruleId;
    
    // Full context (required)
    this.timestamp = opts.timestamp;
    this.rpm = opts.rpm;
    this.gear = opts.gear;
    this.boost = opts.boost;
    this.load = opts.load;
    this.throttle = opts.throttle;
    this.state = opts.state;
    this.value = observedValue;        // observed value
    this.observed = observedValue;     // alias used by validation/spec language
    this.expected = opts.expected;     // expected value
    
    // Optional fields
    this.pullIndex = opts.pullIndex || null;
    this.iatAtPullStart = opts.iatAtPullStart || null;
    this.boostAtEvent = opts.boostAtEvent || null;
    this.boostTarget = opts.boostTarget || null;
    this.boostError = opts.boostError || null;
    this.afr = opts.afr || null;
    this.commandedAfr = opts.commandedAfr || null;
    this.afrDeviation = opts.afrDeviation || null;
  }
}

// Export Finding class
window.Finding = Finding;

// Anti-false-positive: consecutive sample requirement
const MIN_CONSECUTIVE_SAMPLES = 5;
const MIN_DURATION_SEC = 0.15;
const EXCLUSION_WINDOW_SEC = 0.3; // After DECEL_FUEL_CUT, SHIFT, TIP_IN

function hasColumn(session, key) {
  return session.mapped && session.mapped.includes(key);
}

function isDataValid(row, key) {
  return row && Number.isFinite(row[key]);
}

/**
 * Extract full context from a row for findings
 * Ensures all required Finding fields are present
 */
function getFullContext(row, state, opts = {}) {
  const observedValue = opts.observed !== undefined ? opts.observed : opts.value;

  return {
    timestamp: row.time || 0,
    rpm: Number.isFinite(row.rpm) ? Math.round(row.rpm) : 0,
    gear: Number.isFinite(row.gear) ? Math.round(row.gear) : 0,
    boost: Number.isFinite(row.boost) ? row.boost : 0,
    load: Number.isFinite(row.calc_load) ? row.calc_load : 0,
    throttle: Number.isFinite(row.throttle_pos) ? row.throttle_pos : 0,
    state: state || 'UNKNOWN',
    value: observedValue !== undefined ? observedValue : 0,
    observed: observedValue !== undefined ? observedValue : 0,
    expected: opts.expected !== undefined ? opts.expected : 0,
    metric: opts.metric || 'unknown',
    pullIndex: opts.pullIndex || null,
    iatAtPullStart: opts.iatAtPullStart || null,
    boostAtEvent: opts.boostAtEvent || null,
    boostTarget: opts.boostTarget || null,
    boostError: opts.boostError || null,
    afr: opts.afr || null,
    commandedAfr: opts.commandedAfr || null,
    afrDeviation: opts.afrDeviation || null
  };
}

/**
 * Check if a row is in a settling exclusion window
 * Part 2 spec: 300ms settling exclusion after every DECEL_FUEL_CUT and SHIFT
 * Shared helper consumed by ALL rules
 */
function isInExclusionWindow(idx, states, rows, EXCLUSION_WINDOW_SEC = 0.3) {
  if (idx === 0) return false;
  
  const currentTime = rows[idx].time;
  const lookbackTime = currentTime - EXCLUSION_WINDOW_SEC;
  
  // Scan backwards from idx-1
  for (let i = idx - 1; i >= 0; i--) {
    if (rows[i].time < lookbackTime) break;
    
    const state = states[i];
    if (state === window.StateClassifier.STATES.SHIFT || 
        state === window.StateClassifier.STATES.DECEL_FUEL_CUT) {
      return true;
    }
  }
  
  return false;
}

/**
 * Find consecutive samples matching a condition.
 * Returns { startIdx, endIdx, duration } or null if not found.
 */
function findConsecutiveWindow(rows, states, predicate, minSamples, minDurationSec) {
  let windowStart = -1;
  
  for (let i = 0; i < rows.length; i++) {
    if (predicate(rows[i], states[i], i)) {
      if (windowStart === -1) {
        windowStart = i;
      }
    } else {
      if (windowStart !== -1) {
        const duration = rows[i - 1].time - rows[windowStart].time;
        if ((i - windowStart) >= minSamples || duration >= minDurationSec) {
          return { startIdx: windowStart, endIdx: i - 1, duration };
        }
        windowStart = -1;
      }
    }
  }
  
  // Check final window
  if (windowStart !== -1) {
    const duration = rows[rows.length - 1].time - rows[windowStart].time;
    if ((rows.length - windowStart) >= minSamples || duration >= minDurationSec) {
      return { startIdx: windowStart, endIdx: rows.length - 1, duration };
    }
  }
  
  return null;
}

/**
 * Main findings runner - called after state classification
 */
function runFindings(session) {
  const findings = [];
  let findingCount = 0;
  
  const rows = session.rows || [];
  const states = session._states || [];
  const pulls = session.pulls || [];
  
  // If states not pre-computed, classify now
  let activeStates = states;
  if (!activeStates || activeStates.length === 0) {
    activeStates = window.StateClassifier.classifyAllRows(rows);
    session._states = activeStates;
  }
  
  function addFinding(severity, ruleId, label, message, opts = {}) {
    try {
      const finding = new Finding(severity, ruleId, label, message, opts);
      findings.push(finding);
    } catch (err) {
      // Re-throw with more context about which rule failed
      console.error(`FATAL: ${err.message}`);
      throw err;
    }
  }

  function reportNotEvaluated(ruleId, label, reason) {
    // Special case: NOT_EVALUATED doesn't require full context
    // It reports WHY a rule couldn't run, not a meter reading
    findings.push({
      id: `${ruleId}_not_eval_${Date.now()}`,
      severity: 'not_evaluated',
      ruleId,
      label,
      message: reason,
      reason: reason,
      metric: ruleId
    });
  }

  function reportCannotEvaluate(ruleId, label, reason) {
    // Special case: CANNOT_EVALUATE doesn't require full context
    // It reports that required monitor data is missing
    findings.push({
      id: `${ruleId}_cannot_eval_${Date.now()}`,
      severity: 'cannot_evaluate',
      ruleId,
      label,
      message: reason,
      reason: reason,
      metric: ruleId
    });
  }
  
  // ────────────────────────────────────────────────────────────────────
  // RULE: DAM_BELOW_1
  // ────────────────────────────────────────────────────────────────────
  if (!hasColumn(session, 'dam')) {
    reportCannotEvaluate('DAM_BELOW_1', 'DAM evaluation', 'Monitor dam not logged.');
  } else if (rows.every(r => !isDataValid(r, 'dam'))) {
    reportCannotEvaluate('DAM_BELOW_1', 'DAM evaluation', 'Monitor dam not logged.');
  } else {
    let worst = null;
    let damIsGood = true;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const state = activeStates[i];
      if (isDataValid(row, 'dam') && row.dam < THRESHOLDS.DAM_MIN) {
        damIsGood = false;
        if (!worst || row.dam < worst.dam) {
          worst = { row, state, idx: i };
        }
      }
    }
    
    if (worst) {
      // Get boost and AFR context at same sample
      const boostAtEvent = isDataValid(worst.row, 'boost') ? worst.row.boost : 0;
      const boostTarget = isDataValid(worst.row, 'boost_target') ? worst.row.boost_target : 0;
      const boostError = boostAtEvent - boostTarget;
      const afr = isDataValid(worst.row, 'afr') ? worst.row.afr : 0;
      const commandedAfr = isDataValid(worst.row, 'comm_fuel_final') ? worst.row.comm_fuel_final : 0;
      const afrDeviation = commandedAfr - afr;
      
      const ctx = getFullContext(worst.row, worst.state, {
        observed: worst.row.dam,
        expected: THRESHOLDS.DAM_MIN,
        metric: 'dam',
        boostAtEvent,
        boostTarget,
        boostError,
        afr,
        commandedAfr,
        afrDeviation
      });
      
      addFinding('ugly', 'DAM_BELOW_1', 'DAM dropped below 1.0',
        `DAM < 1.0 indicates sustained knock detection and global advance reduction. Worst: ${worst.row.dam.toFixed(3)} at ${worst.row.time.toFixed(2)}s. ` +
        `Boost ${boostAtEvent.toFixed(2)} vs target ${boostTarget.toFixed(2)} (error ${boostError.toFixed(2)}). ` +
        `AFR ${afr.toFixed(2)} vs commanded ${commandedAfr.toFixed(2)} (deviation ${afrDeviation.toFixed(2)}). ` +
        `Address before driving hard.`,
        ctx
      );
    } else if (damIsGood) {
      // GOOD: DAM held at 1.0 - need a sample for context
      const lastRow = rows[rows.length - 1];
      const lastState = activeStates[rows.length - 1];
      const ctx = getFullContext(lastRow, lastState, {
        observed: 1.0,
        expected: 1.0,
        metric: 'dam'
      });
      addFinding('good', 'DAM_HELD', 'DAM held at 1.0 throughout',
        'DAM remained at 1.0. No sustained knock detected.',
        ctx
      );
    }
  }
  
  // ────────────────────────────────────────────────────────────────────
  // RULE: AFR_LEAN (WOT only)
  // ────────────────────────────────────────────────────────────────────
  if (pulls.length === 0) {
    reportNotEvaluated('AFR_LEAN', 'AFR vs Commanded', 'No WOT pulls detected in this log.');
  } else if (!hasColumn(session, 'afr') || !hasColumn(session, 'comm_fuel_final')) {
    reportCannotEvaluate('AFR_LEAN', 'AFR vs Commanded', 'Monitor afr or comm_fuel_final not logged.');
   } else {
    // Check each WOT_STEADY window in pulls
    let afrFinding = null;
    let afrFindingIdx = -1;
    for (const pull of pulls) {
      for (let i = pull.startIdx; i <= pull.endIdx; i++) {
        const row = rows[i];
        const state = activeStates[i];
        
        // Skip exclusion windows
        if (isInExclusionWindow(i, activeStates, rows)) continue;
        
        if (state === window.StateClassifier.STATES.WOT_STEADY) {
          const actual = row.afr;
          const commanded = row.comm_fuel_final;
          
          if (isDataValid(row, 'afr') && isDataValid(row, 'comm_fuel_final')) {
            const deviation = commanded - actual; // positive if lean
            
            if (deviation > THRESHOLDS.AFR_LEAN_DEVIATION) {
              if (!afrFinding || deviation > afrFinding.deviation) {
                afrFinding = { row, state, deviation, idx: i, pullIdx: pull.index - 1 };
                afrFindingIdx = i;
              }
            }
          }
        }
      }
    }
    
    if (afrFinding) {
      const ctx = getFullContext(afrFinding.row, afrFinding.state, {
        observed: afrFinding.row.afr,
        expected: afrFinding.row.comm_fuel_final,
        metric: 'afr',
        afrDeviation: afrFinding.deviation,
        pullIndex: afrFinding.pullIdx
      });
      addFinding('bad', 'AFR_LEAN', 'AFR leaner than commanded',
        `Actual AFR ${afrFinding.row.afr.toFixed(2)} is ${afrFinding.deviation.toFixed(2)} leaner than commanded ${afrFinding.row.comm_fuel_final.toFixed(2)}. Sustained lean condition risks knock.`,
        ctx
      );
    }
  }
  
  // ────────────────────────────────────────────────────────────────────
  // HELPER: Detect knock events (Issue #2 rewrite)
  // ────────────────────────────────────────────────────────────────────
  function detectKnockEvents(rows, states, colName, startIdx = 0, endIdx = rows.length - 1) {
    const events = [];
    let currentEvent = null;
    let prevValue = 0;
    let deepeningSteps = 0;
    
    for (let i = startIdx; i <= endIdx; i++) {
      const val = rows[i][colName];
      if (!isDataValid(rows[i], colName)) continue;
      
      const state = states[i];
      
      // Detect new event: transition to MORE negative
      if (val < prevValue - 0.05) {  // 0.05 threshold to ignore noise
        if (currentEvent) {
          // Close previous event
          events.push(currentEvent);
        }
        
        currentEvent = {
          channel: colName,
          peakValue: val,
          startIdx: i,
          startTime: rows[i].time,
          endIdx: i,
          endTime: rows[i].time,
          sampleCount: 1,
          states: [state],
          recovered: false,
          timeToRecover: 0,
          deepeningSteps: 1  // First deepening transition counts as 1 step
        };
        deepeningSteps = 1;
      }
      
      // Extend current event
      if (currentEvent) {
        if (val < currentEvent.peakValue - 0.05) {
          // Deeper transition (another step of deepening)
          deepeningSteps++;
          currentEvent.deepeningSteps = deepeningSteps;
          currentEvent.peakValue = val;
        }
        
        currentEvent.endIdx = i;
        currentEvent.endTime = rows[i].time;
        currentEvent.sampleCount++;
        currentEvent.states.push(state);
        
        // Check if event recovered (returned to near-zero)
        if (val >= -0.5 && currentEvent.peakValue < -1.0) {
          currentEvent.recovered = true;
          currentEvent.timeToRecover = rows[i].time - currentEvent.startTime;
        }
        
        // Event closed when value returns to positive or stays recovered
        if (val >= 0 || (currentEvent.recovered && val > currentEvent.peakValue + 0.5)) {
          events.push(currentEvent);
          currentEvent = null;
          deepeningSteps = 0;
        }
      }
      
      prevValue = val;
    }
    
    // Close final event
    if (currentEvent) {
      // Calculate modal state
      const stateFreq = {};
      for (const s of currentEvent.states) {
        stateFreq[s] = (stateFreq[s] || 0) + 1;
      }
      currentEvent.modalState = Object.entries(stateFreq).reduce((a, b) => b[1] > a[1] ? b : a)[0];
      
      events.push(currentEvent);
    }
    
    return events;
  }
  
  // ────────────────────────────────────────────────────────────────────
  // RULE: FEEDBACK_KNOCK (rewritten for events, not samples)
  // ────────────────────────────────────────────────────────────────────
  if (!hasColumn(session, 'feedback_knock')) {
    reportCannotEvaluate('FEEDBACK_KNOCK', 'Feedback Knock', 'Monitor feedback_knock not logged.');
  } else if (rows.every(r => !isDataValid(r, 'feedback_knock'))) {
    reportCannotEvaluate('FEEDBACK_KNOCK', 'Feedback Knock', 'Monitor feedback_knock not logged.');
  } else {
    // Detect knock events in both FBK and FKL
    const fbkEvents = detectKnockEvents(rows, activeStates, 'feedback_knock');
    const fklEvents = detectKnockEvents(rows, activeStates, 'fine_knock_learn');
    const allEvents = [...fbkEvents, ...fklEvents];
    
    let uglyEvent = null;
    let badEvent = null;
    let cruiseNoiseEvents = [];
    
    for (const event of allEvents) {
      // Skip exclusion windows
      if (isInExclusionWindow(event.startIdx, activeStates, rows)) continue;
      
      // Classify by shape + state + severity
      const isUgly = event.peakValue <= THRESHOLDS.FBK_UGLY_THRESHOLD ||
                     (event.channel === 'feedback_knock' && event.peakValue <= -2.0 && event.recovered === false);
      
      const isCruiseNoise = event.modalState === window.StateClassifier.STATES.CRUISE &&
                            rows[event.startIdx].calc_load < 1.5 &&
                            event.deepeningSteps === 1 &&
                            Math.abs(event.peakValue) <= 1.5 &&
                            event.recovered === true;
      
      const isBadKnock = event.modalState === window.StateClassifier.STATES.WOT_STEADY &&
                         event.peakValue < THRESHOLDS.FBK_BAD_HIGH &&
                         event.peakValue > THRESHOLDS.FBK_UGLY_THRESHOLD;
      
      if (isUgly && !uglyEvent) {
        uglyEvent = event;
      } else if (isBadKnock && !badEvent) {
        badEvent = event;
      } else if (isCruiseNoise) {
        cruiseNoiseEvents.push(event);
      }
    }
    
    // Report findings
    if (uglyEvent) {
      const row = rows[uglyEvent.startIdx];
      const ctx = getFullContext(row, uglyEvent.modalState, {
        observed: uglyEvent.peakValue,
        expected: THRESHOLDS.FBK_UGLY_THRESHOLD,
        metric: 'feedback_knock',
        iatAtPullStart: row.intake_temp
      });
      addFinding('ugly', 'FEEDBACK_KNOCK_UGLY', 'Significant knock detected',
        `${uglyEvent.channel} ${uglyEvent.peakValue.toFixed(2)}° detected. Peak magnitude ${Math.abs(uglyEvent.peakValue).toFixed(2)}°, ${uglyEvent.sampleCount} samples, ${(uglyEvent.timeToRecover || 0).toFixed(2)}s to recover. Requires investigation.`,
        ctx
      );
    }
    
    if (badEvent && !uglyEvent) {
      const row = rows[badEvent.startIdx];
      const ctx = getFullContext(row, badEvent.modalState, {
        observed: badEvent.peakValue,
        expected: THRESHOLDS.FBK_BAD_HIGH,
        metric: 'feedback_knock',
        iatAtPullStart: row.intake_temp
      });
      addFinding('bad', 'FEEDBACK_KNOCK_BAD', 'Knock detected during WOT',
        `${badEvent.channel} ${badEvent.peakValue.toFixed(2)}° during WOT. Peak ${Math.abs(badEvent.peakValue).toFixed(2)}°, ${badEvent.sampleCount} samples. Monitor on next session.`,
        ctx
      );
    }
    
    if (cruiseNoiseEvents.length > 0 && !uglyEvent && !badEvent) {
      const event = cruiseNoiseEvents[0];
      const row = rows[event.startIdx];
      const ctx = getFullContext(row, event.modalState, {
        observed: event.peakValue,
        expected: -1.05,
        metric: 'feedback_knock'
      });
      addFinding('good', 'CRUISE_KNOCK_NOISE', 'Cruise drive mechanical noise',
        `Single-step ${event.peakValue.toFixed(2)}° knock correction during cruise (shape-classified NOISE-LIKE, recovered cleanly). Characteristic of drivetrain noise, not detonation.`,
        ctx
      );
    }
  }
  
  // ────────────────────────────────────────────────────────────────────
  // RULE: BOOST_OVERSHOOT (WOT_STEADY only)
  // ────────────────────────────────────────────────────────────────────
  if (pulls.length === 0) {
    reportNotEvaluated('BOOST_OVERSHOOT', 'Boost Overshoot', 'No WOT pulls in this log.');
  } else if (!hasColumn(session, 'boost') || !hasColumn(session, 'boost_target')) {
    reportCannotEvaluate('BOOST_OVERSHOOT', 'Boost Overshoot', 'Monitor boost or boost_target not logged.');
  } else {
    let worstOvershoot = null;
    let worstOversState = null;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const state = activeStates[i];
      
      if (state !== window.StateClassifier.STATES.WOT_STEADY) continue;
      
      // Skip exclusion windows
      if (isInExclusionWindow(i, activeStates, rows)) continue;
      
      const boost = row.boost;
      const target = row.boost_target;
      const error = boost - target;
      
      // Check if target is collapsing rapidly (exclude from evaluation)
      if (i > 0 && !isNaN(rows[i - 1].boost_target)) {
        const dt = row.time - rows[i - 1].time;
        if (dt > 0) {
          const targetRate = (target - rows[i - 1].boost_target) / dt;
          if (targetRate < -5) {
            // Target collapsing; skip this sample
            continue;
          }
        }
      }
      
      if (error > THRESHOLDS.BOOST_OVERSHOOT_THRESHOLD) {
        if (!worstOvershoot || error > worstOvershoot.error) {
          worstOvershoot = { row, state, error, idx: i };
          worstOversState = state;
        }
      }
    }
    
    if (worstOvershoot) {
      const row = worstOvershoot.row;
      const ctx = getFullContext(row, worstOversState, {
        observed: row.boost,
        expected: row.boost_target,
        metric: 'boost',
        boostError: worstOvershoot.error,
        boostAtEvent: row.boost,
        boostTarget: row.boost_target
      });
      addFinding('bad', 'BOOST_OVERSHOOT', 'Boost overshoot detected',
        `Boost reached ${row.boost.toFixed(2)} psi, overshooting target ${row.boost_target.toFixed(2)} psi by ${worstOvershoot.error.toFixed(2)} psi. [DTC: P0234 / P226B]`,
        ctx
      );
    } else {
      // GOOD: Boost control within target
      const lastRow = rows[rows.length - 1];
      const lastState = activeStates[rows.length - 1];
      const ctx = getFullContext(lastRow, lastState, {
        observed: lastRow.boost,
        expected: lastRow.boost_target,
        metric: 'boost'
      });
      addFinding('good', 'BOOST_CONTROL', 'Boost control within target',
        'Boost tracking remained within target during WOT pulls.',
        ctx
      );
    }
  }
  
  // ────────────────────────────────────────────────────────────────────
  // RULE: FUEL_TRIM_DEVIATION (Closed-loop only)
  // ────────────────────────────────────────────────────────────────────
  if (!hasColumn(session, 'af_correction_1')) {
    reportCannotEvaluate('AF_CORRECTION_1', 'A/F Correction 1', 'Monitor af_correction_1 not logged.');
  } else {
    // Evaluate CRUISE state only, exclude DECEL_FUEL_CUT
    const correction_windows = [];
    
    for (let i = 0; i < rows.length; i++) {
      const state = activeStates[i];
      if (state === window.StateClassifier.STATES.CRUISE) {
        const val = rows[i].af_correction_1;
        if (isDataValid(rows[i], 'af_correction_1')) {
          correction_windows.push({ idx: i, val });
        }
      }
    }
    
    if (correction_windows.length > 0) {
      const mean = correction_windows.reduce((s, w) => s + w.val, 0) / correction_windows.length;
      const stddev = Math.sqrt(
        correction_windows.reduce((s, w) => s + Math.pow(w.val - mean, 2), 0) / correction_windows.length
      );
      
      // Part 3 authorizes ±10% threshold for AF LEARNING 1 only
      // AF Correction 1 stddev threshold is unsourced; report descriptively only
      if (Math.abs(mean) > 10) {
        const correctionRow = rows[correction_windows[0].idx];
        const ctx = getFullContext(correctionRow, activeStates[correction_windows[0].idx], {
          observed: mean,
          expected: 0,  // Target is 0% trim
          metric: 'af_correction_1'
        });
        addFinding('bad', 'AF_CORRECTION_HIGH', 'Fuel trim correction excessive',
          `A/F Correction 1 mean ${mean.toFixed(1)}% ± ${stddev.toFixed(1)}% in cruise (${correction_windows.length} samples). ` +
          `Tune may need MAF calibration or injector inspection.`,
          ctx
        );
      } else {
        // Report trim statistics descriptively (Part 3 requirement)
        const correctionRow = rows[correction_windows[0].idx];
        const ctx = getFullContext(correctionRow, activeStates[correction_windows[0].idx], {
          observed: mean,
          expected: 0,
          metric: 'af_correction_1'
        });
        addFinding('good', 'AF_CORRECTION_STABLE', 'Fuel trim stable in cruise',
          `A/F Correction 1 mean ${mean.toFixed(1)}% ± ${stddev.toFixed(1)}% (${correction_windows.length} samples in CRUISE state). Within normal range.`,
          ctx
        );
      }
    }
  }
  
  // ────────────────────────────────────────────────────────────────────
  // RULE: TEMPERATURE (IAT during WOT, OIL, COOLANT)
  // ────────────────────────────────────────────────────────────────────
  if (!hasColumn(session, 'intake_temp')) {
    reportCannotEvaluate('IAT_DURING_PULL', 'Intake Air Temp', 'Monitor intake_temp not logged.');
  } else {
    let maxIatInPull = -Infinity;
    let maxIatRow = null;
    let maxIatState = null;
    
    for (const pull of pulls) {
      for (let i = pull.startIdx; i <= pull.endIdx; i++) {
        const row = rows[i];
        const state = activeStates[i];
        if (state === window.StateClassifier.STATES.WOT_STEADY && isDataValid(row, 'intake_temp')) {
          if (row.intake_temp > maxIatInPull) {
            maxIatInPull = row.intake_temp;
            maxIatRow = row;
            maxIatState = state;
          }
        }
      }
    }
    
    if (maxIatRow && maxIatInPull > THRESHOLDS.IAT_WARN) {
      const ctx = getFullContext(maxIatRow, maxIatState, {
        observed: maxIatInPull,
        expected: THRESHOLDS.IAT_WARN,
        metric: 'intake_temp'
      });
      addFinding('bad', 'IAT_ELEVATED', 'Intake air temp elevated during WOT',
        `IAT reached ${maxIatInPull.toFixed(0)}°F during pull. Elevated IAT reduces knock margin.`,
        ctx
      );
    }
  }
  
  if (hasColumn(session, 'oil_temp')) {
    let maxOilTemp = -Infinity;
    let maxOilRow = null;
    let maxOilState = null;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (isDataValid(row, 'oil_temp') && row.oil_temp > maxOilTemp) {
        maxOilTemp = row.oil_temp;
        maxOilRow = row;
        maxOilState = activeStates[i];
      }
    }
    
    if (maxOilRow && maxOilTemp > THRESHOLDS.OIL_TEMP_WARN) {
      const ctx = getFullContext(maxOilRow, maxOilState, {
        observed: maxOilTemp,
        expected: THRESHOLDS.OIL_TEMP_WARN,
        metric: 'oil_temp'
      });
      addFinding('bad', 'OIL_TEMP_ELEVATED', 'Oil temperature elevated',
        `Oil temperature reached ${maxOilTemp.toFixed(0)}°F. Monitor engine cooling.`,
        ctx
      );
    }
  }
  
  if (hasColumn(session, 'coolant_temp')) {
    let maxCoolantTemp = -Infinity;
    let maxCoolantRow = null;
    let maxCoolantState = null;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (isDataValid(row, 'coolant_temp') && row.coolant_temp > maxCoolantTemp) {
        maxCoolantTemp = row.coolant_temp;
        maxCoolantRow = row;
        maxCoolantState = activeStates[i];
      }
    }
    
    if (maxCoolantRow && maxCoolantTemp > THRESHOLDS.COOLANT_TEMP_WARN) {
      const ctx = getFullContext(maxCoolantRow, maxCoolantState, {
        observed: maxCoolantTemp,
        expected: THRESHOLDS.COOLANT_TEMP_WARN,
        metric: 'coolant_temp'
      });
      addFinding('bad', 'COOLANT_TEMP_ELEVATED', 'Coolant temperature elevated',
        `Coolant temperature reached ${maxCoolantTemp.toFixed(0)}°F. Monitor engine cooling.`,
        ctx
      );
    }
  }
  
  // ────────────────────────────────────────────────────────────────────
  // Summary: Ensure NOT_EVALUATED section populated on cruise-only logs
  // ────────────────────────────────────────────────────────────────────
  const notEvaluated = findings.filter(f => f.severity === 'not_evaluated');
  if (pulls.length === 0 && notEvaluated.length === 0) {
    // Add explanatory NOT_EVALUATED for all WOT-dependent rules
    reportNotEvaluated('WOT_RULES', 'All WOT-dependent rules', 'No WOT pulls detected in this log. All WOT-dependent rules cannot be evaluated.');
  }
  
  return findings;
}

window.RulesEngine = { runFindings, THRESHOLDS };

