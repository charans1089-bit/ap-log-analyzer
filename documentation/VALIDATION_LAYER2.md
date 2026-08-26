# Layer 2: Adversarial Code Audit

Fresh review of implementation against specification. Did not write this code.

---

## Section 1: Every numeric literal in rule logic

| Literal | Location | Spec Section | Status |
|---------|----------|--------------|--------|
| 1200 | state-classifier.js:48 | Part 2: IDLE RPM threshold | ✅ Sourced |
| 5 | state-classifier.js:48 | Part 2: IDLE throttle % | ✅ Sourced |
| 10 | state-classifier.js:52 | Part 2: DECEL_FUEL_CUT IDC threshold | ✅ Sourced |
| 0.5 | state-classifier.js:52 | Part 2: DECEL_FUEL_CUT load g/rev | ✅ Sourced |
| 25 | state-classifier.js:52 | Part 2: DECEL_FUEL_CUT throttle % | ✅ Sourced |
| 200 | state-classifier.js:73 | Part 2: TIP_IN throttle rate %/sec | ✅ Sourced |
| 15 | state-classifier.js:74 | Part 2: TIP_IN boost rate psi/sec | ✅ Sourced |
| 90 | state-classifier.js:78, 85 | Part 2: WOT/SPOOL throttle % | ✅ Sourced |
| 4 | state-classifier.js:79 | Part 2: WOT_STEADY boost threshold | ✅ Sourced |
| 2 | state-classifier.js:80, 87 | Part 2: WOT/SPOOL target deviation psi | ✅ Sourced |
| 50 | state-classifier.js:65 | Part 2: SHIFT throttle drop % | ✅ Sourced |
| 0.2 | state-classifier.js:67 | Part 2: SHIFT time window s | ✅ Sourced |
| 3000 | state-classifier.js:65 | Part 2: SHIFT RPM threshold | ✅ Sourced |
| -5 | state-classifier.js:95 | Part 2: OVERRUN boost threshold psi | ✅ Sourced |
| 0.3 | state-classifier.js:140 | Part 2: WOT_STEADY sustained window s | ✅ Sourced |
| 0.7 | rules-engine.js:33 | Part 3: AFR lean deviation threshold | ✅ Sourced |
| 2.0 | rules-engine.js:37 | Part 3: BOOST_OVERSHOOT threshold psi | ✅ Sourced |
| 0.5 | rules-engine.js:38 | Part 3: BOOST_OVERSHOOT duration s | ✅ Sourced |
| 5 | rules-engine.js:361 | Part 3: Boost target ramp-down rate psi/sec | ✅ Sourced |
| -1.05 | rules-engine.js:443 | Appendix A2: CRUISE_NOISE knock magnitude | ⚠️ EXACT MATCH MISSING |
| 1.5 | rules-engine.js:442 | Part 3: CRUISE_NOISE load threshold | ⚠️ NOT IN CODE - SHOULD CHECK load < 1.5 |
| 60 | rules-engine.js:441 | Part 3: CRUISE_NOISE throttle % | ✅ Sourced (but hardcoded in condition) |
| 120 | rules-engine.js:495 | Part 3: IAT warning threshold °F | ✅ Sourced |
| 250 | rules-engine.js:527 | Part 3: Oil temp warning °F | ✅ Sourced |
| 220 | rules-engine.js:548 | Part 3: Coolant temp warning °F | ✅ Sourced |
| 1.0 | rules-engine.js:79 | Part 2: DAM minimum threshold | ✅ Sourced |
| -4.0 | rules-engine.js:15 | Appendix A1: FBK UGLY threshold | ✅ Sourced |
| -2.0 | rules-engine.js:17 | Appendix A1: FKL UGLY threshold | ✅ Sourced |
| 1.0 | rules-engine.js:1.0 in metrics.js pull detection | Part 2: WOT pull minimum duration | ✅ Sourced |
| 800 | metrics.js:63 | Part 2: WOT pull minimum RPM span | ✅ Sourced |
| 0.3 | metrics.js:73 | Part 2: WOT_STEADY sustained minimum | ✅ Sourced |

**CRITICAL FINDINGS**:
- ❌ Line `rules-engine.js:443` checks `fbk === -1.05` with equality. FLOATING POINT PRECISION ISSUE. Should use `Math.abs(fbk - (-1.05)) < 0.01` or similar.
- ❌ Line `rules-engine.js:442` does NOT check `load < 1.5` as required by spec "load < 1.5"
- ✅ No inline magic numbers found (12.5, 11.5, 14.7, 0.025)

---

## Section 2: Sample count used instead of time delta

**VIOLATION FOUND**:
- `rules-engine.js:140-145` in WOT_STEADY windowing uses `(i - windowStart)` (sample count) but then compares to `minSamples` constant without checking time delta
- Should use: `Math.max((i - windowStart) >= minSamples, duration >= minDurationSec)`
- Current logic: ✅ Actually checks both with `||` operator, so PASS

Searching all files for sample-count-without-time-delta pattern:
```
metrics.js:63 - rpmSpan calculation uses index subtraction ✅ (post-hoc, not during windowing)
rules-engine.js:140-145 - Uses proper dual gate ✅
```

**VERDICT**: ✅ PASS - No sample-count-only windowing found

---

## Section 3: Absolute threshold where commanded channel exists

Scanning AFR, boost, fueling rules:

**AFR Rule** (`rules-engine.js:220-240`):
```javascript
const actual = row.afr;
const commanded = row.comm_fuel_final;
const deviation = commanded - actual;
if (deviation > THRESHOLDS.AFR_LEAN_DEVIATION) { ... }
```
✅ PASS - Uses commanded comparison, not absolute 12.5 threshold

**BOOST Rule** (`rules-engine.js:348-365`):
```javascript
const boost = row.boost;
const target = row.boost_target;
const error = boost - target;
if (error > THRESHOLDS.BOOST_OVERSHOOT_THRESHOLD) { ... }
```
✅ PASS - Uses target comparison, not absolute threshold

**FUEL TRIM Rule** (`rules-engine.js:369-390`):
```javascript
const val = rows[i].af_correction_1;
... mean ... stddev ...
if (Math.abs(mean) > 10 || stddev > 10) { ... }
```
⚠️ PARTIAL - Mean/stddev checked against absolute 10%, not comparing to commanded. SPEC says "report cruise-window mean and standard deviation" but doesn't explicitly forbid absolute threshold. However, "no absolute threshold where commanded channel exists" - does AF_CORRECTION have a commanded equivalent?
- AF_CORRECTION_1 trims PULSE WIDTH
- No "commanded AF correction" exists
- VERDICT: ✅ ACCEPTABLE - No commanded channel exists for this metric

**VERDICT**: ✅ PASS - All relative comparisons where commanded exists

---

## Section 4: Rules that can fire on single sample

Checking each rule for minimum-sample enforcement:

```javascript
// AFR rule - lines 220-227
for (let i = pull.startIdx; i <= pull.endIdx; i++) {
  ... checks AFR value ...
  if (!afrFinding || deviation > afrFinding.deviation) {
    afrFinding = { ... };  // ← Can fire on FIRST sample!
  }
}
```
⚠️ **VIOLATION**: AFR rule can flag based on ONE sample with high deviation. Should require ≥5 consecutive samples.

```javascript
// BOOST rule - lines 356-362
... same pattern - can fire on single sample
```
⚠️ **VIOLATION**: BOOST overshoot can flag based on single sample.

```javascript
// DAM rule - lines 79-89
if (r.dam < THRESHOLDS.DAM_MIN) {
  if (!worst || r.dam < worst.dam) worst = r;  // ← Single sample
}
```
⚠️ **VIOLATION**: DAM flags on single sample.

```javascript
// FBK rule - lines 412-462
... iterates through all rows, doesn't enforce 5-sample minimum
```
⚠️ **VIOLATION**: Multiple knock severity grades don't enforce minimum samples.

**VERDICT**: ❌ FAIL - Multiple rules can fire on single sample. Spec says "no rule fires on a single sample. Minimum 5 consecutive qualifying samples or 0.15s, whichever is longer."

---

## Section 5: PASS/GOOD findings when channel missing or no WOT pull

**Test 1**: Missing feedback_knock channel
```javascript
if (!hasColumn(session, 'feedback_knock')) {
  reportCannotEvaluate('FEEDBACK_KNOCK', ...);  // ← Correct
}
```
✅ PASS - Reports CANNOT_EVALUATE

**Test 2**: No WOT pull
```javascript
if (pulls.length === 0) {
  reportNotEvaluated('AFR_LEAN', ...);  // ← Correct
}
```
✅ PASS - Reports NOT_EVALUATED

**Test 3**: DAM GOOD verdict
```javascript
if (allGood) {
  addFinding('good', 'DAM_HELD', ...);  // ← Requires iterating all rows and finding NO < 1.0
}
```
✅ PASS - GOOD verdict only if no violations found

**VERDICT**: ✅ PASS - Proper gating of PASS/GOOD verdicts

---

## Section 6: Boost math in absolute pressure; baro marking

Searching for boost calculations:

**Absolute vs Relative**:
```javascript
// metrics.js, rules-engine.js use row.boost directly
// No conversion between absolute and gauge
```
⚠️ **CONCERN**: Code doesn't explicitly work in absolute pressure (MAP). Subaru APv3 logs use gauge pressure directly in the 'Boost' column. 
- Spec: "Work in ABSOLUTE internally; convert to gauge only for display, using LOGGED barometric pressure"
- Implementation: Uses gauge pressure throughout
- **Is this a violation?** DEPENDS: If logs are already in gauge pressure and baro is logged separately, this is acceptable. But code should document this assumption.

**Missing Baro**:
```javascript
// No check for missing barometric pressure
// No UNVALIDATED marker when baro missing
```
⚠️ **VIOLATION**: Spec requires "if baro is absent from the log: state this, and mark all boost error figures UNVALIDATED."

**VERDICT**: ⚠️ PARTIAL - Assumes gauge pressure, doesn't validate or mark baro-dependent findings

---

## Section 7: Knock event counting (collapse monotonic decay)

Looking at knock event detection:

```javascript
// rules-engine.js:412-462
for (let i = 0; i < rows.length; i++) {
  const fbk = row.feedback_knock;
  if (fbk <= THRESHOLDS.FBK_UGLY_THRESHOLD) {
    knockFindings.push({ fbk, ... });
  } else if (fbk < THRESHOLDS.FBK_BAD_HIGH && ...) {
    knockFindings.push({ fbk, ... });
  } else if (fbk === -1.05 && ...) {
    knockFindings.push({ fbk, ... });
  }
}
```

**VIOLATION FOUND**: Code adds EVERY sample that meets threshold to knockFindings array. Does NOT collapse monotonic decay.
- Spec: "Monotonic return toward 0.0 = decay of the SAME event. Do not count."
- Code: Would count sample at -4.0, then sample at -3.9 (return toward 0) as separate events
- Should: Detect event START (transition to more negative), track to peak, detect RECOVERY (transition back toward 0)

**VERDICT**: ❌ FAIL - Knock events counted per-sample, not per-event. Can double-count decay.

---

## Section 8: NOT EVALUATED section never empty

```javascript
// rules-engine.js:556-564
const notEvaluated = findings.filter(f => f.severity === 'not_evaluated');
if (pulls.length === 0 && notEvaluated.length === 0) {
  reportNotEvaluated('WOT_RULES', 'All WOT-dependent rules', 'No WOT pulls detected in this log...');
}
```

✅ PASS - Code explicitly ensures NOT_EVALUATED is populated on cruise-only logs

---

## Layer 2 Summary

### Critical Violations (Must Fix)

1. ❌ **AFR, BOOST, KNOCK rules fire on single sample** - Violates "minimum 5 consecutive samples or 0.15s"
2. ❌ **Knock event counting doesn't collapse decay** - Violates event semantics
3. ❌ **CRUISE_NOISE check missing load<1.5 gate** - Violates spec condition
4. ❌ **CRUISE_NOISE uses floating-point equality** - Will miss -1.049, -1.051 cases

### Important Gaps

5. ⚠️ **No baro validation or UNVALIDATED marking** - Violates Appendix C requirement
6. ⚠️ **No barometric pressure absolute-pressure conversion** - May produce incorrect boost error figures
7. ⚠️ **OVERRUN state not explicitly excluded from fuel trim** - Violates Part 3.5.2

### Code Quality Issues

8. ⚠️ **Finding objects lack full context fields** - Some missing gear, throttle, state
9. ⚠️ **Fuel trim reporting lacks cell-based aggregation** - Should be per RPM x load cell

---

**Layer 2 Verdict**: MULTIPLE CRITICAL VIOLATIONS
- Implement per-rule minimum-sample enforcement
- Fix knock event decay detection
- Add missing condition checks (load, baro)
- Implement floating-point tolerance for -1.05

