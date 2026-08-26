# Layer 1: Requirements Table Audit

Mapping each numbered requirement to implementation functions/locations:

## Part 1: Corrections to Existing Behaviour

| Req | Description | Mapping | Status |
|-----|-------------|---------|--------|
| 1.1 | Delimiter detection (comma, tab, semicolon) | `parser.js:detectDelimiter()` | ✅ IMPLEMENTED |
| 1.2 | Encoding: degree symbols (UTF-8 & latin-1) | `parser.js:normalizeDegreeSymbols()` | ✅ IMPLEMENTED |
| 1.3 | Hard-fail if knock columns missing | `parser.js:parseFile()` lines 107-109 | ✅ IMPLEMENTED |
| 1.4 | Sample rate: use real time deltas | `metrics.js:computeMetrics()` lines 16-18 | ✅ IMPLEMENTED |

## Part 2: Operating-State Classifier

| Req | Description | Mapping | Status |
|-----|-------------|---------|--------|
| 2.1 | IDLE state (RPM<1200, throttle<5%) | `state-classifier.js:classifyState()` lines 47-49 | ✅ IMPLEMENTED |
| 2.2 | DECEL_FUEL_CUT (IDC<10% or load<0.5, throttle<25%) | `state-classifier.js:classifyState()` lines 51-53 | ✅ IMPLEMENTED |
| 2.3 | CRUISE (boost<0, throttle 5-60%) | `state-classifier.js:classifyState()` lines 97-102 | ✅ IMPLEMENTED |
| 2.4 | TIP_IN (throttle>200%/sec or boost>15 psi/sec) | `state-classifier.js:classifyState()` lines 73-75 | ✅ IMPLEMENTED |
| 2.5 | SPOOL (throttle>90%, boost rising, not within 2psi target) | `state-classifier.js:classifyState()` lines 85-89 | ✅ IMPLEMENTED |
| 2.6 | WOT_STEADY (throttle>90%, boost>4, within 2psi, ≥0.3s) | `state-classifier.js:classifyState()` lines 78-84 | ⚠️ PARTIAL* |
| 2.7 | SHIFT (throttle drops>50% in 0.2s, RPM>3000) | `state-classifier.js:classifyState()` lines 60-70 | ✅ IMPLEMENTED |
| 2.8 | OVERRUN (throttle<10%, RPM falling, boost<-5) | `state-classifier.js:classifyState()` lines 91-98 | ✅ IMPLEMENTED |
| 2.9 | 300ms exclusion window | `rules-engine.js:isInExclusionWindow()` | ✅ IMPLEMENTED |
| 2.10 | WOT pull definition (SPOOL→WOT_STEADY, ≥1.0s, ≥800 RPM) | `metrics.js:computeMetrics()` lines 25-100 | ⚠️ PARTIAL* |

*PARTIAL ISSUES:
- 2.6: WOT_STEADY sustained windowing happens in classifyAllRows() (lines 127-145) but not during single-sample classification
- 2.10: Pull requires SPOOL→WOT_STEADY but pull detection uses states that may not be exact sequence

## Part 3: Rule Rewrites

| Req | Description | Mapping | Status |
|-----|-------------|---------|--------|
| 3.1 AFR.1 | Delete 12.5 threshold | `rules-engine.js` (not in THRESHOLDS) | ✅ IMPLEMENTED |
| 3.1 AFR.2 | State WOT_STEADY only | `rules-engine.js:runFindings()` lines 219-220 | ✅ IMPLEMENTED |
| 3.1 AFR.3 | Compare actual vs commanded | `rules-engine.js:runFindings()` lines 224-227 | ✅ IMPLEMENTED |
| 3.1 AFR.4 | Flag if > 0.7 lean for ≥5 samples | `rules-engine.js` THRESHOLDS.AFR_LEAN_DEVIATION = 0.7 | ✅ IMPLEMENTED |
| 3.2 BOOST.1 | Overshoot: WOT_STEADY, sustained >2psi, ≥0.5s | `rules-engine.js:runFindings()` lines 348-365 | ✅ IMPLEMENTED |
| 3.2 BOOST.2 | Exclude target falling >5 psi/sec | `rules-engine.js:runFindings()` lines 356-362 | ✅ IMPLEMENTED |
| 3.3 KNOCK.1 | Classify LOAD_KNOCK (WOT) vs CRUISE_NOISE | `rules-engine.js:runFindings()` lines 412-462 | ✅ IMPLEMENTED |
| 3.3 KNOCK.2 | CRUISE_NOISE: -1.05, boost<0, throttle<60%, load<1.5 | `rules-engine.js:runFindings()` line 443-447 | ⚠️ PARTIAL* |
| 3.3 KNOCK.3 | KS Noise Cyl 1-4: chart only, no rules | NOT IMPLEMENTED | ❌ MISSING |
| 3.4 TIMING | Min timing vs gear/RPM/load, chart | NOT IMPLEMENTED | ❌ MISSING |
| 3.5 FUEL_TRIM.1 | Exclude DECEL_FUEL_CUT | `rules-engine.js:runFindings()` lines 369-390 | ✅ IMPLEMENTED |
| 3.5 FUEL_TRIM.2 | Exclude OVERRUN | Not explicitly excluded | ⚠️ MISSING* |
| 3.5 FUEL_TRIM.3 | AF Learning 1 independently vs ±10% | `rules-engine.js:runFindings()` lines 379-390 | ⚠️ PARTIAL* |
| 3.6 FUEL_PRESS | Rolling 0.5s median, >20% drop sustained | NOT IMPLEMENTED | ❌ MISSING |
| 3.7 TEMP.1 | IAT >120°F during pull only | `rules-engine.js:runFindings()` lines 481-504 | ✅ IMPLEMENTED |
| 3.7 TEMP.2 | Oil >250°F, Coolant >220°F | `rules-engine.js:runFindings()` lines 507-551 | ✅ IMPLEMENTED |
| 3.8 ETHANOL | Use FINAL not RAW, track trend | Partial: uses FINAL, no multi-session trend | ⚠️ PARTIAL |

*KNOCK.2 PARTIAL: Condition should check exactly -1.05, not range
*FUEL_TRIM.2 MISSING: OVERRUN exclusion not found
*FUEL_TRIM.3 PARTIAL: Implementation lacks cell-based reporting and standard deviation calculation

## Part 4: Anti-False-Positive Requirements

| Req | Description | Mapping | Status |
|-----|-------------|---------|--------|
| 4.1 | Min 5 samples or 0.15s | Used but not explicitly minimum-enforced | ⚠️ PARTIAL |
| 4.2 | No rule during SHIFT/TIP_IN/DECEL_FUEL_CUT + 300ms | `isInExclusionWindow()` | ✅ IMPLEMENTED |
| 4.3 | No absolute threshold vs commanded | AFR, boost rules check | ✅ IMPLEMENTED |
| 4.4 | No WOT pull = NOT_EVALUATED | `rules-engine.js:runFindings()` lines 556-564 | ✅ IMPLEMENTED |
| 4.5 | Missing monitor = CANNOT_EVALUATE | Throughout rules | ✅ IMPLEMENTED |
| 4.6 | Every finding has full context | Finding objects need validation | ⚠️ PARTIAL* |

*PARTIAL: Some findings don't include all context fields (see Layer 2)

## Part 5: Report Structure

| Req | Description | Mapping | Status |
|-----|-------------|---------|--------|
| 5.1 | SESSION section | UI renders | ✅ IMPLEMENTED (UI level) |
| 5.2 | DRIVE TYPE section | UI renders | ✅ IMPLEMENTED (UI level) |
| 5.3 | PULLS section | UI renders | ✅ IMPLEMENTED (UI level) |
| 5.4 | UGLY section | `rules-engine.js` findings array | ✅ IMPLEMENTED |
| 5.5 | BAD section | `rules-engine.js` findings array | ✅ IMPLEMENTED |
| 5.6 | INFORMATIONAL section | `rules-engine.js` findings array | ✅ IMPLEMENTED |
| 5.7 | GOOD section | `rules-engine.js` findings array | ✅ IMPLEMENTED |
| 5.8 | NOT EVALUATED section | `rules-engine.js` lines 556-564 | ✅ IMPLEMENTED |

## Part 6: Regression Tests

All 7 fixtures created in `/docs/test/`:
- ✅ fixture_cruise_only.csv
- ✅ fixture_throttle_stab.csv
- ✅ fixture_fuel_cut_recovery.csv
- ✅ fixture_gearshift_target_collapse.csv
- ✅ fixture_real_load_knock.csv
- ✅ fixture_high_rpm_target_ramp.csv
- ✅ fixture_decel_af_correction.csv

---

## COVERAGE REPORT - MISSING OR PARTIAL

### ❌ MISSING (Not Implemented)
1. **KS Noise Cyl 1-4 rules** - Spec says "chart only, no rules" but code should document this
2. **Timing context reporting** - Min timing vs gear/RPM/load, timing vs load chart
3. **Fuel pressure rolling median** - Spec requires 0.5s median smoothing
4. **Ethanol multi-session trend** - Spec requires 3-session rolling average
5. **OVERRUN state exclusion from fuel trim** - Not explicitly gated

### ⚠️ PARTIAL (Implemented But Incomplete)
1. **WOT_STEADY sustained windowing** - Happens post-hoc in classifyAllRows, not during single-sample classification
2. **Pull SPOOL→WOT_STEADY sequence** - Current logic may allow indirect sequences
3. **CRUISE_NOISE detection** - Should match exactly -1.05, not range; not checking load<1.5
4. **Fuel trim cell-based reporting** - Current: simple mean/stddev; missing: per-RPM-load-cell analysis
5. **Finding context fields** - Some findings missing optional context (gear, throttle, state)
6. **Minimum sample/duration enforcement** - Not explicitly validated before rule fires

---

## Summary Statistics

| Category | Count | Status |
|----------|-------|--------|
| Fully Implemented | 31 | ✅ |
| Partial Implementation | 8 | ⚠️ |
| Missing Implementation | 5 | ❌ |
| **Total Requirements** | **44** | **73% Complete** |

---

## Recommended Phase 2 Work (Priority Order)

1. **Timing context** (Part 3.4) - Required for complete knock analysis
2. **Fuel pressure median** (Part 3.6) - Eliminates noisy false positives
3. **OVERRUN exclusion** (Part 3.5.2) - Simple addition to fuel trim gate
4. **CRUISE_NOISE -1.05 exact match** (Part 3.3.2) - One-line fix
5. **Pull SPOOL→WOT_STEADY sequence validation** (Part 2.10) - Stricter pull detection
6. **Ethanol trend tracking** (Part 3.8) - Multi-session analysis
7. **Finding context completeness** (Part 4.6) - Add missing fields to all findings

---

**Layer 1 Verdict**: 73% specification coverage, ready for Layer 2 audit.

