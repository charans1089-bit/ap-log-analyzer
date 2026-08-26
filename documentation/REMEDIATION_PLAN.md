# Remediation Plan - Critical Issues & Fixes

Based on Layer 2, 3, and 5 audits, here are all issues with proposed fixes.

---

## CRITICAL ISSUES (Block Production Release)

### Issue 1: Rules Fire on Single Sample ❌

**Location**: `rules-engine.js` - AFR, BOOST, KNOCK, DAM rules
**Violation**: Spec says "no rule fires on a single sample. Minimum 5 consecutive qualifying samples or 0.15s, whichever is longer"
**Current Behavior**: Finds worst sample and flags it immediately
**Impact**: False positives on transient conditions

**PROPOSED FIX**:

Create a helper function:
```javascript
/**
 * Find consecutive qualifying samples meeting minimum threshold
 * Returns { startIdx, endIdx, duration } or null
 */
function findConsecutiveWindow(rows, states, startIdx, endIdx, predicate, minSamples, minDurationSec) {
  let windowStart = -1;
  
  for (let i = startIdx; i <= endIdx; i++) {
    if (predicate(rows[i], states[i])) {
      if (windowStart === -1) windowStart = i;
    } else {
      if (windowStart !== -1) {
        const duration = rows[i - 1].time - rows[windowStart].time;
        const sampleCount = i - windowStart;
        if (sampleCount >= minSamples || duration >= minDurationSec) {
          return { startIdx: windowStart, endIdx: i - 1, duration, sampleCount };
        }
        windowStart = -1;
      }
    }
  }
  
  // Check final window
  if (windowStart !== -1) {
    const duration = rows[endIdx].time - rows[windowStart].time;
    const sampleCount = endIdx - windowStart + 1;
    if (sampleCount >= minSamples || duration >= minDurationSec) {
      return { startIdx: windowStart, endIdx: endIdx, duration, sampleCount };
    }
  }
  
  return null;
}
```

**Apply to AFR rule** (replace lines 220-240):
```javascript
// AFR_LEAN rule - WOT_STEADY only
if (pulls.length === 0) {
  reportNotEvaluated('AFR_LEAN', 'AFR vs Commanded', 'No WOT pulls detected in this log.');
} else if (!hasColumn(session, 'afr') || !hasColumn(session, 'comm_fuel_final')) {
  reportCannotEvaluate('AFR_LEAN', 'AFR vs Commanded', 'Monitor afr or comm_fuel_final not logged.');
} else {
  let afrFinding = null;
  for (const pull of pulls) {
    // Find window of consecutive samples with high AFR deviation
    const window = findConsecutiveWindow(rows, activeStates, pull.startIdx, pull.endIdx,
      (row, state) => {
        if (state !== window.StateClassifier.STATES.WOT_STEADY) return false;
        if (!isDataValid(row, 'afr') || !isDataValid(row, 'comm_fuel_final')) return false;
        const deviation = row.comm_fuel_final - row.afr;
        return deviation > THRESHOLDS.AFR_LEAN_DEVIATION;
      },
      MIN_CONSECUTIVE_SAMPLES,
      MIN_DURATION_SEC
    );
    
    if (window) {
      const row = rows[window.startIdx];
      const endRow = rows[window.endIdx];
      const deviation = row.comm_fuel_final - row.afr;
      afrFinding = { row, endRow, window, deviation, pullIdx: pull.index - 1 };
      break;  // Report first occurrence
    }
  }
  
  if (afrFinding) {
    // ... emit finding with full context ...
  }
}
```

---

### Issue 2: Knock Event Decay Counted as Separate Events ❌

**Location**: `rules-engine.js` lines 412-462
**Violation**: Spec says "Monotonic return toward 0.0 = decay of the SAME event. Do not count."
**Current Behavior**: Each sample meeting threshold = separate event
**Impact**: Multi-counts single knock event

**PROPOSED FIX**:

Replace knock detection with event-tracking algorithm:
```javascript
/**
 * Detect knock events, collapsing monotonic decay into one event
 * A new event = transition to MORE negative value
 * Decay = return toward zero (same event)
 */
function detectKnockEvents(rows, states, startIdx, endIdx) {
  const events = [];
  let currentEvent = null;
  let prevValue = 0;
  
  for (let i = startIdx; i <= endIdx; i++) {
    const fbk = rows[i].feedback_knock;
    if (!isDataValid(rows[i], 'feedback_knock')) continue;
    
    const state = states[i];
    
    // Detect new event: transition to more negative
    if (fbk < prevValue - 0.1) {  // 0.1 threshold to ignore noise
      if (currentEvent) events.push(currentEvent);
      currentEvent = {
        peakValue: fbk,
        startIdx: i,
        startTime: rows[i].time,
        endIdx: i,
        endTime: rows[i].time,
        samples: 1,
        state: state,
        recovered: false
      };
    }
    
    // Extend current event or recover
    if (currentEvent) {
      if (fbk < currentEvent.peakValue) {
        currentEvent.peakValue = fbk;  // Deeper negative
      }
      currentEvent.endIdx = i;
      currentEvent.endTime = rows[i].time;
      currentEvent.samples++;
      
      // Event recovered if returns to near zero
      if (fbk >= -0.5 && currentEvent.peakValue < -1.0) {
        currentEvent.recovered = true;
      }
    }
    
    prevValue = fbk;
  }
  
  if (currentEvent) events.push(currentEvent);
  return events;
}
```

Then use in knock rule:
```javascript
// Detect events, not samples
const events = detectKnockEvents(rows, activeStates, 0, rows.length - 1);

for (const event of events) {
  // Classify event
  if (event.state === window.StateClassifier.STATES.WOT_STEADY && event.peakValue <= -4.0) {
    // UGLY LOAD_KNOCK
  } else if (event.state === window.StateClassifier.STATES.WOT_STEADY && event.peakValue < -2.0) {
    // BAD LOAD_KNOCK
  } else if (event.state === window.StateClassifier.STATES.CRUISE && 
             Math.abs(event.peakValue - (-1.05)) < 0.01) {  // Floating-point tolerance!
    // CRUISE_NOISE informational
  }
}
```

---

### Issue 3: CRUISE_NOISE Missing load<1.5 Gate ❌

**Location**: `rules-engine.js` line 443
**Violation**: Spec says `boost < 0, throttle < 60%, load < 1.5, value exactly −1.05`
**Current Code**: 
```javascript
else if (fbk === -1.05 && state === window.StateClassifier.STATES.CRUISE)
```
**Missing**: load < 1.5 check, and floating-point exact match

**PROPOSED FIX**:
```javascript
else if (Math.abs(fbk - (-1.05)) < 0.01 &&      // Floating-point tolerance
         state === window.StateClassifier.STATES.CRUISE &&
         row.calc_load < 1.5) {                 // Add load gate
  // CRUISE_NOISE
  knockFindings.push({
    idx: i,
    severity: 'info',
    type: 'CRUISE_NOISE',
    fbk,
    state,
    reason: `FBK ${fbk.toFixed(2)}° characteristic of cruise-drive mechanical noise, not detonation.`
  });
}
```

---

### Issue 4: Barometric Pressure Validation Missing ❌

**Location**: `rules-engine.js` boost rule
**Violation**: Spec Appendix C says "if baro is absent from the log: state this, and mark all boost error figures UNVALIDATED"
**Current Behavior**: No validation, assumes gauge pressure
**Impact**: Boost errors could be meaningless at altitude

**PROPOSED FIX**:

In rules-engine.js header:
```javascript
// Check baro availability
const hasBaro = hasColumn(session, 'baro');
let boostMarkup = '';
if (!hasBaro) {
  boostMarkup = ' (UNVALIDATED — barometric pressure not logged)';
}
```

In boost rule:
```javascript
if (worstOvershoot) {
  const row = worstOvershoot.row;
  addFinding('bad', 'BOOST_OVERSHOOT', 'Boost overshoot detected',
    `Boost reached ${row.boost.toFixed(2)} psi, overshooting target by ${worstOvershoot.error.toFixed(2)} psi${boostMarkup}. Risk of overboosting and mechanical damage.`,
    {
      metric: 'boost',
      timestamp: row.time,
      rpm: Math.round(row.rpm),
      boost: row.boost,
      throttle: row.throttle_pos,
      value: worstOvershoot.error
    }
  );
}
```

---

### Issue 5: Missing Mandatory Cross-Reference (DAM + Boost/AFR) ❌

**Location**: `rules-engine.js` DAM rule
**Violation**: Spec says "On DAM<1.0, also check boost vs target and AFR vs commanded for failsafe/enrichment behaviour, and report together"
**Current Behavior**: Only reports DAM value
**Impact**: Incomplete analysis of knock response

**PROPOSED FIX**:

After DAM_BELOW_1 finding:
```javascript
if (worst && worst.dam < THRESHOLDS.DAM_MIN) {
  addFinding('ugly', 'DAM_BELOW_1', 'DAM dropped below 1.0', ...);
  
  // MANDATORY CROSS-REFERENCE
  const worstRow = worst;
  const boost = worstRow.boost;
  const boostTarget = worstRow.boost_target;
  const afr = worstRow.afr;
  const commFuel = worstRow.comm_fuel_final;
  
  let crossRefMsg = '';
  if (isDataValid(worstRow, 'boost') && isDataValid(worstRow, 'boost_target')) {
    const boostError = boost - boostTarget;
    crossRefMsg += `Boost ${boost.toFixed(2)} psi vs target ${boostTarget.toFixed(2)} (error ${boostError.toFixed(2)} psi). `;
  }
  if (isDataValid(worstRow, 'afr') && isDataValid(worstRow, 'comm_fuel_final')) {
    const afrDev = commFuel - afr;
    crossRefMsg += `AFR ${afr.toFixed(2)} vs commanded ${commFuel.toFixed(2)} (deviation ${afrDev.toFixed(2)}). `;
  }
  
  if (crossRefMsg) {
    addFinding('info', 'DAM_FAILSAFE_CONTEXT', 'DAM failsafe cross-reference',
      crossRefMsg + 'ECU triggered knock mitigation. Check boost control and fueling.',
      { ... context ... }
    );
  }
}
```

---

## IMPORTANT ISSUES (Should Fix Before Production)

### Issue 6: Missing Full Context Fields in Findings ⚠️

**Location**: All findings construction
**Violation**: Spec Part 4.6: "Every finding must carry: timestamp, RPM, gear, boost, load, throttle, operating state"
**Current Behavior**: Many findings omit gear, state, throttle, etc.

**PROPOSED FIX**:

Helper function to get full row context:
```javascript
function getFullContext(row, state, pullIdx) {
  return {
    timestamp: row.time || null,
    rpm: Number.isFinite(row.rpm) ? Math.round(row.rpm) : null,
    gear: Number.isFinite(row.gear) ? Math.round(row.gear) : null,
    boost: Number.isFinite(row.boost) ? row.boost : null,
    load: Number.isFinite(row.calc_load) ? row.calc_load : null,
    throttle: Number.isFinite(row.throttle_pos) ? row.throttle_pos : null,
    state: state || null,
    pullIndex: pullIdx || null
  };
}
```

Use in every finding:
```javascript
const ctx = getFullContext(row, state, pullIdx);
addFinding(severity, ruleId, label, message, { 
  metric: ...,
  ...ctx 
});
```

---

### Issue 7: Target Ramp-Down Threshold Off-By-One ⚠️

**Location**: `rules-engine.js` line 361
**Current**: `if (targetRate < -5)`
**Should Be**: `if (targetRate <= -5)` or threshold slightly higher
**Impact**: May allow false overshoot when ramp = exactly -5 psi/sec

**FIX**:
```javascript
const TARGET_RAMP_THRESHOLD = 4.9;  // psi/sec, slightly less than 5 to avoid boundary
if (targetRate < -TARGET_RAMP_THRESHOLD) {
  // Target collapsing; skip this sample
  continue;
}
```

---

### Issue 8: Missing OVERRUN Exclusion from Fuel Trim ⚠️

**Location**: `rules-engine.js` fuel trim rule
**Should**: Exclude OVERRUN state like DECEL_FUEL_CUT
**Current**: Only excludes CRUISE state

**FIX**:
```javascript
// Line 370
for (let i = 0; i < rows.length; i++) {
  const state = activeStates[i];
  // Only evaluate CRUISE state
  if (state === window.StateClassifier.STATES.CRUISE) {  // ← Add this gate
    const val = rows[i].af_correction_1;
    if (isDataValid(rows[i], 'af_correction_1')) {
      correction_windows.push({ idx: i, val });
    }
  }
}
```

---

### Issue 9: Encoding Robustness ⚠️

**Location**: `parser.js` file.text()
**Issue**: Browser may misinterpret latin-1 CSVs as UTF-8

**PROPOSED FIX** (if dealing with real latin-1 CSVs):
```javascript
// Try UTF-8 first, then latin-1
async function parseFileWithEncoding(file) {
  let text = await file.text();  // Browser default
  
  // If degree symbol appears corrupted, retry with latin-1 detection
  if (!text.includes('°') && text.includes('\xB0')) {
    // Attempt recovery from misinterpreted UTF-8
    text = new TextDecoder('iso-8859-1').decode(await file.arrayBuffer());
  }
  
  return text;
}
```

---

## MINOR ISSUES (Nice to Have)

### Issue 10: Add DTC Codes to Boost Findings

**Location**: `rules-engine.js` boost rule output
**Enhancement**: Include P0234/P226B codes

```javascript
const dtcCode = worstOvershoot.error > 5 ? 'P0234' : 'P226B';
const message = `Boost reached ${row.boost.toFixed(2)} psi, overshooting target by ${worstOvershoot.error.toFixed(2)} psi. ... [DTC: ${dtcCode}]`;
```

---

### Issue 11: Pull Start IAT Context

**Location**: Knock findings during pulls
**Enhancement**: Report IAT at pull start

```javascript
function getPullStartIAT(rows, pull) {
  for (let i = pull.startIdx; i <= pull.endIdx; i++) {
    if (Number.isFinite(rows[i].intake_temp)) {
      return rows[i].intake_temp;
    }
  }
  return null;
}

// In knock rule
const pullStartIAT = getPullStartIAT(rows, pull);
addFinding(..., { 
  ...ctx,
  iat_at_pull_start: pullStartIAT
});
```

---

## Implementation Priority

1. **IMMEDIATE (Blocking)**:
   - [ ] Issue 1: Single-sample minimum enforcement
   - [ ] Issue 2: Knock event decay detection
   - [ ] Issue 3: CRUISE_NOISE load gate + floating-point tolerance
   - [ ] Issue 4: Baro validation + UNVALIDATED marking
   - [ ] Issue 5: DAM cross-reference

2. **CRITICAL (Before Release)**:
   - [ ] Issue 6: Full context fields in all findings
   - [ ] Issue 7: Target ramp threshold fix
   - [ ] Issue 8: OVERRUN exclusion

3. **IMPORTANT (Polish)**:
   - [ ] Issue 9: Encoding robustness
   - [ ] Issue 10: DTC codes
   - [ ] Issue 11: Pull start IAT

---

## Testing After Fixes

After implementing all fixes:

1. **Re-run Layer 3 fixtures**:
   - F01: Should now report 1 CRUISE_NOISE event (decay collapsed)
   - F04: Should not report overshoot
   - F07: Should include boost/AFR cross-reference
   - F10: Should mark findings UNVALIDATED

2. **Regression test suite**:
   - Run all 7 test CSVs
   - Verify no new false positives introduced
   - Check context fields populated

3. **Production logs**:
   - Run on your 4 real logs
   - Verify UGLY findings still = 0 (no false positives)
   - Verify NOT_EVALUATED section populated on cruise-only logs

---

**Estimated Implementation Time**: 4-6 hours
**Estimated Testing Time**: 2-3 hours
**Risk Level After Fixes**: LOW

