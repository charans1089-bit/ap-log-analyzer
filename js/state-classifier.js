'use strict';

/**
 * Operating State Classifier
 * Classifies each sample into exactly one state before rules run.
 * States are based on engine operating conditions, not raw thresholds.
 */

const STATES = {
  IDLE:                'IDLE',
  DECEL_FUEL_CUT:      'DECEL_FUEL_CUT',
  CRUISE:              'CRUISE',
  TIP_IN:              'TIP_IN',
  SPOOL:               'SPOOL',
  WOT_STEADY:          'WOT_STEADY',
  SHIFT:               'SHIFT',
  OVERRUN:             'OVERRUN',
  UNKNOWN:             'UNKNOWN'
};

/**
 * Classify a single sample into an operating state.
 * 
 * @param {Object} row - Current data row
 * @param {Object} prevRow - Previous data row (for rate-of-change detection)
 * @param {number} idx - Row index in the dataset
 * @param {Array} allRows - All data rows (for context)
 * @returns {string} - One of STATES values
 */
function classifyState(row, prevRow, idx, allRows) {
  const rpm = row.rpm || 0;
  const throttle = row.throttle_pos || 0;
  const boost = row.boost || 0;
  const idc = row.inj_duty_cycle || 0;
  const load = row.calc_load || 0;
  const boost_target = row.boost_target || 0;
  
  // Detect throttle rate of change (requires previous row)
  let throttle_rate = 0;
  let boost_rate = 0;
  if (prevRow && !isNaN(prevRow.time) && !isNaN(row.time)) {
    const dt = row.time - prevRow.time;
    if (dt > 0) {
      const prev_throttle = prevRow.throttle_pos || 0;
      const prev_boost = prevRow.boost || 0;
      throttle_rate = (throttle - prev_throttle) / dt; // %/sec
      boost_rate = (boost - prev_boost) / dt; // psi/sec
    }
  }
  
  // IDLE: RPM < 1200, throttle < 5%
  if (rpm < 1200 && throttle < 5) {
    return STATES.IDLE;
  }
  
  // DECEL_FUEL_CUT: IDC < 10% or load < 0.5 g/rev, with throttle < 25%
  if ((idc < 10 || load < 0.5) && throttle < 25) {
    return STATES.DECEL_FUEL_CUT;
  }
  
  // SHIFT: throttle drops > 50% within 0.2 s while RPM > 3000
  // Detect this by looking for rapid throttle decrease
  if (prevRow && rpm > 3000) {
    const prev_throttle = prevRow.throttle_pos || 0;
    const throttle_drop = prev_throttle - throttle; // positive when dropping
    if (throttle_drop > 50) {
      // Verify it happened quickly (within 0.2s)
      const dt = row.time - prevRow.time;
      if (dt <= 0.2) {
        return STATES.SHIFT;
      }
    }
  }
  
  // OVERRUN: throttle < 10%, RPM falling, boost < −5 psi
  if (prevRow && throttle < 10 && boost < -5) {
    const prev_rpm = prevRow.rpm || 0;
    if (rpm < prev_rpm) {
      return STATES.OVERRUN;
    }
  }
  
  // WOT_STEADY: throttle > 90%, boost > 4 psi (sustained ≥ 0.3 s via windowing)
  if (throttle > 90 && boost > 4) {
    return STATES.WOT_STEADY;
  }

  // TIP_IN: throttle rising > 200%/sec, or boost rising > 15 psi/sec
  if (throttle_rate > 200 || boost_rate > 15) {
    return STATES.TIP_IN;
  }
  
  // CRUISE: boost < 0, throttle 5–60%, steady RPM
  // Steady RPM detection: RPM change < ~200 RPM in 0.5 s
  if (boost < 0 && throttle > 5 && throttle < 60) {
    // Optionally verify steady RPM
    return STATES.CRUISE;
  }
  
  // Default fallback
  return STATES.UNKNOWN;
}

/**
 * Classify all rows in a session into states.
 * Handles windowing for sustained state detection (e.g., WOT_STEADY ≥ 0.3 s).
 * 
 * @param {Array} rows - All data rows
 * @returns {Array} - Array of state assignments, one per row
 */
function classifyAllRows(rows) {
  if (!rows || rows.length === 0) return [];
  
  const states = [];
  const rawStates = [];
  
  // First pass: classify each sample individually
  for (let i = 0; i < rows.length; i++) {
    const prevRow = i > 0 ? rows[i - 1] : null;
    const state = classifyState(rows[i], prevRow, i, rows);
    rawStates.push(state);
  }
  
  // Second pass: apply sustained-state window logic for WOT_STEADY
  // WOT_STEADY must be sustained ≥ 0.3 s. Collapse brief instances to adjacent state.
  for (let i = 0; i < rawStates.length; i++) {
    let stateToAssign = rawStates[i];
    
    if (stateToAssign === STATES.WOT_STEADY) {
      // Check sustained duration
      let end = i;
      while (end < rawStates.length && rawStates[end] === STATES.WOT_STEADY) {
        end++;
      }
      const duration = rows[end - 1].time - rows[i].time;
      
      // If duration < 0.3 s, collapse to adjacent state
      if (duration < 0.3) {
        // Use SPOOL or adjacent state
        stateToAssign = rawStates[i - 1] || STATES.SPOOL;
      }
    }
    
    states.push(stateToAssign);
  }
  
  return states;
}

window.StateClassifier = {
  STATES,
  classifyState,
  classifyAllRows
};

