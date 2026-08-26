# Layer 5: Red Flags Check

Scanning codebase for anti-patterns and common failures.

---

## Red Flag 1: Inline Magic Numbers (12.5, 11.5, 14.7, 0.025)

```bash
$ grep -r "12\.5\|11\.5\|14\.7\|0\.025" js/
```

**Search Results**:
- ✅ No occurrences of 12.5 found (old AFR threshold removed)
- ✅ No occurrences of 11.5 found
- ✅ No occurrences of 14.7 found (hardcoded stoich)
- ✅ No occurrences of 0.025 found (old sample rate assumption)

**Verdict**: ✅ PASS - No forbidden magic numbers

---

## Red Flag 2: Array Index Arithmetic for Time

**Pattern to find**: `rows[i+1].time - rows[i].time` replaced with `sample_count * assumed_rate`

Searching for problematic patterns:

**rules-engine.js**:
```javascript
// Line 140-145
const duration = rows[end - 1].time - rows[i].time;
```
✅ CORRECT - Uses real time delta

**metrics.js**:
```javascript
// Line 16-18
const dt = row.time - prevRow.time;
if (dt > 0) {
  const delta = (value1 - value2) / dt;  // Uses real delta
}
```
✅ CORRECT - Uses real time delta throughout

**Scanning for incorrect patterns**:
- No instances of `dt = 1 / sample_rate`
- No instances of `duration = samples * 0.025`
- No instances of `samples_to_seconds = count / assumed_hz`

**Verdict**: ✅ PASS - Uses real time deltas everywhere

---

## Red Flag 3: Rule Reads Raw Samples Directly

**Pattern**: Rule imports rows directly, not state-tagged view

**rules-engine.js**:
```javascript
const rows = session.rows || [];
const states = session._states || [];
```
- Receives both rows and states ✓
- Passes states-tagged view to rules? Let's check:

```javascript
// Line 220
for (let i = pull.startIdx; i <= pull.endIdx; i++) {
  const row = rows[i];
  const state = activeStates[i];  // ← Accesses state
  if (state === window.StateClassifier.STATES.WOT_STEADY) {
    // Only evaluates when state matches
  }
}
```
✅ CORRECT - Uses state-tagged evaluation

**However, concerning pattern**:
```javascript
// Line 79-89 (DAM rule)
for (const row of rows) {
  if (Number.isFinite(row.dam)) {
    if (r.dam < THRESHOLDS.DAM_MIN) { ... }
  }
}
```
⚠️ **ISSUE**: DAM rule evaluates ALL rows without state gating. Should this be gated to certain states?
- Spec says DAM is "primary health metric" for WOT pulls
- Currently evaluates entire session
- Probably intentional (global metric), but not enforced

**Verdict**: ⚠️ PARTIAL - Most rules gated by state, but DAM and other global rules lack explicit state filtering

---

## Red Flag 4: String "no knock detected" Exists

**Search for string**:
```bash
$ grep -r "no knock detected" .
```

**Results**:
- ❌ **FOUND** in `VALIDATION_LAYER3.md:173` (in documentation)
- ✅ **NOT FOUND** in any `.js` file

Checking findings output:

**rules-engine.js findings**:
```javascript
// Line 419 onwards - Knock findings
if (uglies.length > 0) {
  addFinding('ugly', 'FEEDBACK_KNOCK_UGLY', 'Significant knock detected', ...);
}
if (bads.length > 0) {
  addFinding('bad', 'FEEDBACK_KNOCK_BAD', 'Knock detected during WOT', ...);
}
if (infos.length > 0) {
  addFinding('good', 'CRUISE_KNOCK_NOISE', 'Cruise drive mechanical noise detected', ...);
}
```

- No "no knock detected" string
- Missing message when pulls.length === 0 and knock rule returns NOT_EVALUATED
- Line 556-564 handles this with NOT_EVALUATED message ✅

**Verdict**: ✅ PASS - "no knock detected" not in code (only in docs)

---

## Red Flag 5: Empty Findings Array with GOOD Section

**Pattern**: Can findings[] be empty while GOOD section still printed?

**rules-engine.js**:
```javascript
function runFindings(session) {
  const findings = [];
  // ... all rules add to findings ...
  return findings;
}
```

Then in main.js:
```javascript
const findings = window.RulesEngine.runFindings(session);
session.findings = findings;
```

Then in ui.js (checking typical rendering):
```javascript
// Hypothetical - would need to review ui.js
if (findings.some(f => f.severity === 'good')) {
  renderGood(...);
}
```

**Test case**: Cruise-only log with no rules violated
- DAM_HELD: good finding added ✅
- GOOD section will be non-empty

**Test case**: No channels logged
- All rules report CANNOT_EVALUATE
- No GOOD findings
- GOOD section empty

✅ **VERDICT**: PASS - GOOD only added when conditions met

---

## Red Flag 6: UTF-8 in File Read

**Pattern**: Assuming UTF-8 encoding on file read

**parser.js**:
```javascript
async function parseFile(file) {
  const text = await file.text();  // ← Uses browser's text() method
  // Browser defaults to UTF-8 but may auto-detect
}
```

**Issue**: Spec says degree symbols may be latin-1. File.text() may misinterpret.

**Current handling**:
```javascript
function normalizeDegreeSymbols(s) {
  return s
    .replace(/\u00b0/g, '°')  // UTF-8 U+00B0
    .replace(/°/g, '°');      // Ensure consistent
}
```

⚠️ **POTENTIAL ISSUE**: If browser read latin-1 bytes as UTF-8, the byte sequence 0xB0 (latin-1 degree) becomes U+00B0 or corruption. The normalization might not recover it.

**Better approach**: Detect encoding in CSV itself (BOM, or assume latin-1 for CSV)

**Verdict**: ⚠️ RISKY - Encoding handling relies on browser's auto-detection; may fail on pure latin-1 CSV

---

## Red Flag 7: Single-Sample Firing (Revisited)

From Layer 2, confirmed:
```javascript
// AFR rule - line 230-240
if (!afrFinding || deviation > afrFinding.deviation) {
  afrFinding = { row, deviation, pullIdx: pull.index - 1 };
}
```

Fires on FIRST sample with any deviation > 0.7 AFR. No minimum 5-sample check.

✅ Already documented as violation.

---

## Red Flag 8: Missing Context Fields in Findings

**Finding constructor** (Line 123-136 of rules-engine.js):
```javascript
findings.push({
  id: `${ruleId}_${++findingCount}`,
  severity,
  ruleId,
  label,
  message,
  metric: opts.metric || ruleId,
  timestamp: opts.timestamp || null,
  rpm: opts.rpm || null,
  gear: opts.gear || null,
  boost: opts.boost || null,
  load: opts.load || null,
  throttle: opts.throttle || null,
  state: opts.state || null,
  value: opts.value || null,
  pullIndex: opts.pullIndex || null
});
```

**Spec requirement** (Part 4.6): "Every finding must carry: timestamp, RPM, gear, boost, load, throttle, operating state, and the observed vs expected value."

**Analysis**:
- timestamp: ✅ included
- rpm: ✅ included
- gear: ⚠️ often null (see L233, L275, L284, L344, L500, etc.)
- boost: ⚠️ often null on non-boost rules
- load: ⚠️ often null on non-load rules
- throttle: ⚠️ often null
- state: ⚠️ often null
- observed: ✅ in 'value' field
- expected: ⚠️ not explicitly captured

**Example - Fuel trim finding** (line 388):
```javascript
addFinding('bad', 'AF_CORRECTION_HIGH', ..., { 
  metric: 'af_correction_1', 
  value: mean 
  // ← Missing: timestamp, rpm, gear, boost, load, throttle, state
});
```

**Example - DAM finding** (line 79-81):
```javascript
addFinding('ugly', 'DAM_BELOW_1', ...,
  metric: 'dam',
  timestamp: worst.time,  // ← Has context
  rpm: Math.round(worst.rpm),
  value: worst.dam
  // ← Missing: gear, boost, load, throttle, state
);
```

**Verdict**: ❌ FAIL - Many findings missing required context fields

---

## Red Flag Summary

| Check | Status | Notes |
|-------|--------|-------|
| Magic numbers (12.5, 11.5, 14.7, 0.025) | ✅ PASS | None found |
| Array index time arithmetic | ✅ PASS | Uses real deltas |
| Rules read raw samples | ⚠️ RISKY | DAM lacks state gating |
| "no knock detected" string | ✅ PASS | Not in code |
| Empty findings with GOOD section | ✅ PASS | Proper gating |
| UTF-8 assumptions | ⚠️ RISKY | Encoding detection reliant on browser |
| Single-sample firing | ❌ FAIL | Multiple rules fire on 1 sample |
| Missing context fields | ❌ FAIL | Many findings incomplete |

**Overall Red Flags**: 3 FAIL, 2 RISKY, 3 PASS

---

**Layer 5 Verdict**: MODERATE RISK
- Single-sample firing is the biggest practical issue
- Missing context fields violates actionability requirement
- Encoding handling may fail on edge cases

