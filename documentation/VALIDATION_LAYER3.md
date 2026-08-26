# Layer 3: Known-Answer Fixtures Validation

Testing implementation against 10 synthetic AP-format CSVs with known expected results.

---

## Test Case F01: Cruise Only with One FBK -1.05 & Decay

**Fixture**: Cruise driving, one FBK event -1.05 with 3-sample decay to 0
**Expected**:
- 0 pulls
- Exactly 1 knock event classified CRUISE_NOISE
- Severity: informational
- NOT_EVALUATED section: non-empty

**Prediction of Current Code**:
```
Pulls: 0 ✅
Knock findings: 4 events ❌ (fires on each sample: -1.05, -0.5, -0.2, 0.0)
Classification: CRUISE_NOISE (correct if conditions match)
NOT_EVALUATED: Will be populated ✅

Result: FAIL - Counts decay as separate events instead of single event
Failure signature matches: "Reports 4 events (decay counted separately)"
```

**Verdict**: ❌ FAIL F01 - Does not collapse monotonic decay

---

## Test Case F02: Throttle Stab (8 samples >90%, 0.2s, peak 0.4 psi)

**Fixture**: Brief throttle stab, 0.2s duration, max boost 0.4 psi
**Expected**:
- 0 pulls detected
- No false pull grading

**Prediction of Current Code**:
```
States during stab: TIP_IN then brief SPOOL, never reaches WOT_STEADY sustained 0.3s
Pull detection: Requires SPOOL→WOT_STEADY, so brief SPOOL alone won't form complete sequence

Result: ✅ PASS - 0 pulls detected
```

**Verdict**: ✅ PASS F02 - WOT_STEADY sustained requirement prevents false pull

---

## Test Case F03: Fuel-Cut Recovery (AFR 15.97 @ 0.18 psi, cmd 14.70; AFC -25.8% @ 1.8% IDC)

**Fixture**: WOT pull followed by throttle lift with fuel-cut AFR and trim data
**Expected**:
- 0 AFR findings (AFR 15.97 not flagged as lean)
- 0 fuel-trim findings (AFC -25.8% not flagged)
- Pulls detected for WOT portion

**Prediction of Current Code**:
```
AFR rule check:
- Searches for WOT_STEADY state windows
- During lift, state is DECEL_FUEL_CUT
- AFR rule only evaluates during WOT_STEADY
- Result: AFR 15.97 NOT in scope ✅ PASS

Fuel trim rule check:
- Only evaluates CRUISE state
- During decel, state is DECEL_FUEL_CUT (excluded) ✅
- AFC -25.8% not evaluated
- Result: No false trim finding ✅ PASS

Pulls: WOT portion detected as 1 pull ✅

Result: ✅ PASS
```

**Verdict**: ✅ PASS F03 - State-based gating prevents both false findings

---

## Test Case F04: Clean 3rd-Gear Pull; Target Deliberately Ramps 17→12 psi above 5000 rpm

**Fixture**: 3+ second WOT pull, target ramps down 5 psi, no knock, no AFR deviation
**Expected**:
- 1 pull detected, gear=3
- No knock findings
- No AFR findings
- No overshoot findings
- GOOD findings populated (DAM held, boost control, etc.)

**Prediction of Current Code**:
```
Pull detection: Should find SPOOL→WOT_STEADY ✅

Overshoot check (rules-engine.js:356-362):
- During sustained WOT: boost vs target checked
- Condition: error > 2.0 psi AND target NOT falling >5 psi/sec
- During ramp-down: targetRate = (12-17)/(t) = -5/t
- If t < 1.0s: targetRate < -5, excluded ✓
- If t = 1.0s: targetRate = -5, NOT excluded (should be excluded)
- Result: May incorrectly flag if ramp-down rate = -5 psi/sec exactly

AFR check: In WOT_STEADY, actual ≈ commanded, no deviation flag ✅

Knock check: No FBK events < threshold ✅

GOOD findings: DAM_HELD populated ✅

Result: LIKELY FAIL (borderline on >5 vs ≥5 condition)
Failure signature: False overshoot from collapsing target (if ramp is exactly -5)
```

**Verdict**: ⚠️ BORDERLINE F04 - Depends on target ramp rate sign (> vs ≥). Off-by-one on threshold comparison.

---

## Test Case F05: Real Load Knock, FBK -3.5 Sustained, DAM Holds 1.000

**Fixture**: WOT pull with FBK -3.5 for multiple consecutive samples, DAM 1.0, all context present
**Expected**:
- 1 pull detected
- LOAD_KNOCK classified
- Severity: BAD (not UGLY)
- Full context: timestamp, RPM, gear, boost, load, throttle, state, IAT at pull start

**Prediction of Current Code**:
```
Pull detection: ✅ Detected

Knock classification (rules-engine.js:412-462):
- FBK -3.5: Check thresholds
  - FBK <= -4.0? NO
  - FBK < -2.0 && WOT_STEADY? YES
  - Will be added to 'bads' array

Severity assignment: Worst of bads used
- Result: 'bad' severity ✅ CORRECT

Context fields in finding:
- timestamp: ✅ row.time
- rpm: ✅ Math.round(row.rpm)
- gear: ⚠️ Not included in finding object
- boost: ✅ row.boost
- load: ✅ row.calc_load
- throttle: ✅ row.throttle_pos
- state: ✅ worst.state
- iat_at_pull_start: ❌ Not found in code

Result: PARTIAL - Missing gear and IAT at pull start
```

**Verdict**: ⚠️ PARTIAL F05 - Severity correct but context fields incomplete

---

## Test Case F06: True Overshoot (2.1 psi over target sustained in WOT_STEADY)

**Fixture**: WOT_STEADY window with boost 2.1 psi above target, sustained ≥0.5s
**Expected**:
- 1 overshoot finding
- Names diagnostic code: P0234 / P226B

**Prediction of Current Code**:
```
Overshoot check (rules-engine.js:356-365):
- Error = 2.1 > threshold 2.0 ✓
- Target not falling >5 psi/sec ✓
- Will flag

Finding message: "Boost reached X psi, overshooting target by 2.1 psi"
- Does NOT include DTC codes P0234/P226B ❌

Result: Finding detected but missing DTC reference
```

**Verdict**: ⚠️ PARTIAL F06 - Detects overshoot but doesn't include DTC codes

---

## Test Case F07: DAM 1.000 → 0.938, Boost Target Drops 17 → 13

**Fixture**: DAM fallback event with boost failsafe target reduction
**Expected**:
- UGLY severity (DAM<1.0)
- Identifies failsafe behavior (target drop)
- Cross-references boost/AFR at same time
- Reports as failsafe event, not tune intent

**Prediction of Current Code**:
```
DAM check (rules-engine.js:79-89):
- DAM 0.938 < 1.0 ✓
- Will flag as UGLY ✅

Cross-reference boost/AFR:
- Code does NOT perform cross-reference with boost/AFR
- Spec says: "Boost vs target whenever DAM < 1.000 (failsafe boost reduction)"
- MISSING

Failsafe identification:
- Code does NOT identify or label as failsafe
- Just reports low DAM
- MISSING

Result: Correct severity but incomplete analysis
```

**Verdict**: ❌ FAIL F07 - Missing mandatory cross-reference and failsafe classification

---

## Test Case F08: Knock Channels Absent from Header

**Fixture**: CSV missing both Feedback Knock and Fine Knock Learn columns
**Expected**:
- CANNOT_EVALUATE (monitor not logged)
- NOT PASS or "no knock detected"

**Prediction of Current Code**:
```
Parse validation (parser.js:107-109):
- Checks hasFeedbackKnock && hasFineKnockLearn
- If either missing: hard-fail parse
- return { ok: false, error: { code: 'CRITICAL_COLUMNS_MISSING', ... } }

Result: File rejected before reaching findings ✅ CORRECT
```

**Verdict**: ✅ PASS F08 - Hard-fail prevents silent failure

---

## Test Case F09: Semicolon-Delimited CSV

**Fixture**: Valid AP-format CSV with semicolon delimiters instead of comma
**Expected**:
- Parses successfully
- 0 pulls (if cruise-only content)
- No garbage column interpretation

**Prediction of Current Code**:
```
Parser delimiter detection (parser.js:65-69):
- Detects tab first, then comma, then semicolon
- Semicolon detected correctly

Parsing proceeds with semicolon split ✅

Result: Should parse successfully
```

**Verdict**: ✅ PASS F09 - Delimiter detection handles semicolon

---

## Test Case F10: No Barometric Channel

**Fixture**: Valid CSV but missing Baro Pressure column
**Expected**:
- All boost error figures marked UNVALIDATED
- No confident boost verdict

**Prediction of Current Code**:
```
Baro check: NOT IMPLEMENTED
- No check for missing baro column
- No UNVALIDATED marker added
- Boost math proceeds as normal

Result: Confident boost findings without baro validation ❌
```

**Verdict**: ❌ FAIL F10 - Missing baro validation and UNVALIDATED marking

---

## Layer 3 Summary

| Test | Expected | Predicted | Verdict | Failure Type |
|------|----------|-----------|---------|--------------|
| F01 | 0 pulls, 1 CRUISE_NOISE event | 4 events | ❌ FAIL | Decay not collapsed |
| F02 | 0 pulls | 0 pulls | ✅ PASS | — |
| F03 | No AFR/trim findings | No findings | ✅ PASS | — |
| F04 | 1 pull, no overshoot | Likely false overshoot | ⚠️ BORDERLINE | Target ramp edge case |
| F05 | BAD severity, full context | BAD + missing fields | ⚠️ PARTIAL | Incomplete context |
| F06 | Overshoot finding + DTC | Overshoot, no DTC | ⚠️ PARTIAL | Missing DTC codes |
| F07 | UGLY + cross-ref + failsafe | UGLY only | ❌ FAIL | Missing cross-ref |
| F08 | CANNOT_EVALUATE | Hard-fail parse | ✅ PASS | — |
| F09 | Parses, 0 pulls | Parses | ✅ PASS | — |
| F10 | UNVALIDATED marking | Confident verdict | ❌ FAIL | Missing baro validation |

**Pass Rate**: 4/10 (40%)
**Fail Rate**: 4/10 (40%)
**Partial**: 2/10 (20%)

---

## Critical Failures (Must Fix Before Production)

1. **F01**: Knock event decay counting - Use event-tracking algorithm, not sample-per-sample
2. **F04**: Target ramp threshold - Use `>=5` instead of `>5`, or slightly higher threshold
3. **F07**: Missing boost/AFR cross-reference when DAM<1.0 - Add mandatory cross-check
4. **F10**: Missing barometric pressure validation - Check and mark UNVALIDATED

## Partial Issues (Should Fix)

1. **F05**: Add gear and pull-start-IAT to finding context
2. **F06**: Add DTC codes to boost overshoot message

---

**Layer 3 Verdict**: CRITICAL FAILURES IN 4/10 TESTS
- Requires substantial fixes to pass known-answer test suite
- Single-sample firing, decay counting, and baro validation are blocking issues

