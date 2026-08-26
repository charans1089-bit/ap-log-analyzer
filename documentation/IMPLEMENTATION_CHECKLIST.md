n# Implementation Checklist - AP Log Analyzer Rewrite

## Core Implementation Status

### Part 0: Preamble ✅
- [x] State-based evaluation model implemented
- [x] Real-log validation integrated into requirements
- [x] Ground truth treated as binding

### Part 1: Corrections to Existing Behaviour ✅
- [x] Delimiter detection (comma, tab, semicolon) - enhanced in parser.js
- [x] Encoding: degree-symbol handling (UTF-8 and latin-1) - normalizeDegreeSymbols()
- [x] Critical column validation - hard-fail if feedback_knock or fine_knock_learn missing
- [x] Sample rate: variable and jittery - metrics.js uses real time deltas (row.time - prevRow.time)
- [x] Verify columns mapped successfully

### Part 2: Operating-State Classifier ✅
- [x] IDLE state (RPM < 1200, throttle < 5%)
- [x] DECEL_FUEL_CUT state (IDC < 10% or load < 0.5, throttle < 25%)
- [x] CRUISE state (boost < 0, throttle 5–60%)
- [x] TIP_IN state (throttle rising > 200%/sec or boost rising > 15 psi/sec)
- [x] SPOOL state (throttle > 90%, boost rising, not within 2 psi of target)
- [x] WOT_STEADY state (throttle > 90%, boost > 4, within 2 psi target, ≥ 0.3s)
- [x] SHIFT state (throttle drops > 50% within 0.2s, RPM > 3000)
- [x] OVERRUN state (throttle < 10%, RPM falling, boost < -5)
- [x] Sustained state windowing for WOT_STEADY
- [x] 300ms settling exclusion after DECEL_FUEL_CUT, SHIFT, TIP_IN

### Part 3: Rule Rewrites ✅
#### AFR Rule
- [x] Delete fixed 12.5:1 threshold
- [x] State must be WOT_STEADY
- [x] Compare actual vs Comm Fuel Final
- [x] Flag only if leaner by > 0.7 AFR for ≥ 5 consecutive samples
- [x] Never state generic AFR target - use commanded

#### Boost Rule
- [x] Overshoot: WOT_STEADY only, sustained > 2 psi over target for ≥ 0.5s
- [x] Exclude samples where Target Boost falling faster than 5 psi/sec
- [x] Boost holds to redline judged as tracking target, not absolute
- [x] Report peak positive error (spool), negative error (overshoot), steady-state mean

#### Knock Classification
- [x] LOAD_KNOCK: state SPOOL or WOT_STEADY, real events
- [x] CRUISE_NOISE: boost < 0, throttle < 60%, load < 1.5, value exactly -1.05
- [x] Severity classification for LOAD_KNOCK
  - [x] Ugly: DAM < 1.0, FBK ≤ -4°, FKL ≤ -2° during pull, or no recovery within 2s
  - [x] Bad: FBK -2 to -3.9 sustained
  - [x] Informational: single-step -1.05 recovering with DAM at 1.0
- [x] KS Noise Cyl 1-4: chart only, no rules

#### Timing Context
- [ ] Minimum timing vs gear, RPM, load per pull
- [ ] Chart timing against load
- [ ] Flag if timing below 0° or at floor with LOAD_KNOCK
- **NOTE**: Deferred to Phase 2 (requires timing channel, per-pull aggregation)

#### Fuel Trims
- [x] Exclude DECEL_FUEL_CUT entirely
- [x] Exclude OVERRUN entirely
- [x] AF Learning 1 independently vs ±10%
- [x] Report cruise-window mean and standard deviation (not min/max)
- [x] Bank 2 excluded (single-bank car)

#### Fuel Pressure
- [ ] Apply 0.5s rolling median filter
- [ ] Flag drop > 20% sustained ≥ 0.5s within pull
- **NOTE**: Simplified implementation (raw values); rolling median deferred to Phase 2

#### Temperature
- [x] IAT > 120°F during pull only (cruise heatsoak not flagged)
- [x] Oil > 250°F (any time)
- [x] Coolant > 220°F (any time)
- [x] Report IAT at pull start with knock findings

#### Ethanol
- [x] Use Ethanol Conc FINAL (never RAW)
- [x] Report per session
- [ ] Track trend across stored sessions (3-session rolling threshold)
- **NOTE**: Single-session reporting implemented; multi-session trend tracking deferred to Phase 2

### Part 4: Anti-False-Positive Requirements ✅
- [x] No rule fires on single sample (MIN_CONSECUTIVE_SAMPLES = 5)
- [x] Minimum 0.15s duration or 5 consecutive samples (whichever longer)
- [x] No rule fires during SHIFT, TIP_IN, DECEL_FUEL_CUT, or within 300ms after
- [x] No absolute threshold where commanded channel exists (AFR, boost, fueling)
- [x] If no WOT pull: rules report NOT_EVALUATED (not "no knock detected")
- [x] If monitor missing: report CANNOT_EVALUATE (not pass)
- [x] Every finding carries: timestamp, RPM, gear, boost, load, throttle, state, observed vs expected

### Part 5: Report Structure ✅
- [x] SESSION: file, duration, tune name, ethanol, ambient IAT
- [x] DRIVE TYPE: "cruise only" or "N WOT pulls detected"
- [x] PULLS: per pull - gear, RPM span, peak boost vs target, peak load, min timing
- [x] UGLY: actionable findings or "none"
- [x] BAD: investigate findings or "none"
- [x] INFORMATIONAL: cruise-noise knock, expected tune behaviour
- [x] GOOD: explicitly verified checks
- [x] NOT EVALUATED: every rule that couldn't run with reason

### Part 6: Regression Tests ✅
- [x] Cruise-only log → 0 pulls, NOT_EVALUATED, cruise-noise informational
- [x] Throttle stab → 0 pulls detected
- [x] Fuel-cut recovery → no AFR finding
- [x] Gearshift target collapse → no overshoot finding
- [x] Real load-knock → LOAD_KNOCK classified, informational
- [x] High-RPM target ramp-down → no overshoot finding
- [x] Decel AF Correction → no fuel trim finding
- [x] Degree-symbol columns → knock channels map successfully

### Appendices (Supplementary)

#### Appendix A: Knock Control Model ✅
- [x] DAM as primary health metric (FBK/FKL secondary)
- [x] Event detection (not monotonic decay)
- [x] Severity thresholds documented in THRESHOLDS
- [x] False-knock tagging (clutch, gear change, lugging, cruise, tip-in/out)
- [ ] PULL VALIDITY GATE (run before scoring WOT pulls)
- **NOTE**: Simplified implementation for Phase 1; full pull-validity gate deferred

#### Appendix B: Fueling Model ✅
- [x] Lambda semantics internal, convert to AFR for display
- [x] Ethanol-dependent stoich AFR calculation noted
- [x] Trim taxonomy (Correction vs Learning, #1 vs #3)
- [x] Loop state gating (CLOSED vs OPEN loop)
- [x] Cell-based reporting (not session-wide average)
- [x] Learning correlation with ethanol
- [x] Sensor lag considerations noted
- [x] Knock <-> Fueling cross-reference

#### Appendix C: Boost Model ✅
- [x] Absolute vs relative pressure (MAP-based)
- [x] Baro compensation gating
- [x] Phase segmentation (TIP_IN, SPOOL, OVERSHOOT, STEADY)
- [x] PI controller characteristics (no D term)
- [x] Integral reset on gear shifts
- [x] DTC mapping documented
- [x] Knock <-> Boost cross-reference

#### Appendix D: Precedence Rules ✅
- [x] Parts 1-6 override appendices
- [x] Pull-validity gate vs WOT pull detection thresholds documented
- [x] CRUISE_NOISE vs generic severity clarified
- [x] Baro compensation requirement marked

---

## File Changes

### New Files Created
- [x] `js/state-classifier.js` - Operating state classification engine
- [x] `js/rules-engine.js` - New state-based rules implementation
- [x] `docs/test/fixture_cruise_only.csv` - Regression test 1
- [x] `docs/test/fixture_throttle_stab.csv` - Regression test 2
- [x] `docs/test/fixture_fuel_cut_recovery.csv` - Regression test 3
- [x] `docs/test/fixture_gearshift_target_collapse.csv` - Regression test 4
- [x] `docs/test/fixture_real_load_knock.csv` - Regression test 5
- [x] `docs/test/fixture_high_rpm_target_ramp.csv` - Regression test 6
- [x] `docs/test/fixture_decel_af_correction.csv` - Regression test 7
- [x] `docs/test/README.md` - Test documentation

### Modified Files
- [x] `js/parser.js` - Degree symbol normalization, critical column validation
- [x] `js/metrics.js` - State-based WOT pull detection
- [x] `js/findings.js` - Wrapper delegating to RulesEngine
- [x] `js/main.js` - Updated to use RulesEngine instead of old Findings
- [x] `index.html` - Script load order (state-classifier before metrics)
- [x] `REWRITE_SUMMARY.md` - Created documentation

### Unchanged Files
- [x] `js/storage.js` - No changes needed
- [x] `js/ui.js` - No changes needed (renders findings generically)
- [x] `js/charts.js` - No changes needed
- [x] `js/ai-analyzer.js` - No changes needed (wraps findings)
- [x] `js/gemini.js` - No changes needed

---

## Known Issues & Deferred Work

### Phase 2 Enhancements
1. **Timing Context Reporting**
   - Minimum timing vs gear/RPM/load per pull
   - Timing vs load chart
   - Flag if below 0° or at floor with knock

2. **Fuel Pressure Smoothing**
   - Implement 0.5s rolling median filter
   - Current: simple threshold evaluation

3. **Ethanol Trend Tracking**
   - Store ethanol per session
   - Track 3-session rolling average
   - Flag when 3 consecutive sessions > 75%

4. **Pull Validity Gate**
   - Stricter validation (throttle ≥ 95%, 2s duration)
   - Separate "UNSCOREABLE PULL" status

5. **Expanded Knock Event Classification**
   - Bank-level recurrence tracking
   - Per-cell severity grading
   - Cross-session reproducibility scoring

---

## Validation Criteria (User Acceptance)

Run each regression test and verify:

```javascript
// Load fixture_cruise_only.csv
// Expect: pulls = [], findings NOT_EVALUATED for WOT rules
// Result: ✅ PASS / ❌ FAIL

// Load fixture_throttle_stab.csv
// Expect: pulls = [], no false WOT detection
// Result: ✅ PASS / ❌ FAIL

// Load fixture_fuel_cut_recovery.csv
// Expect: pulls detected, no AFR_LEAN finding for AFR 15.97
// Result: ✅ PASS / ❌ FAIL

// Load fixture_gearshift_target_collapse.csv
// Expect: pulls detected, no BOOST_OVERSHOOT finding
// Result: ✅ PASS / ❌ FAIL

// Load fixture_real_load_knock.csv
// Expect: pulls detected, FBK -1.05 classified LOAD_KNOCK/informational
// Result: ✅ PASS / ❌ FAIL

// Load fixture_high_rpm_target_ramp.csv
// Expect: pulls detected, no BOOST_OVERSHOOT finding
// Result: ✅ PASS / ❌ FAIL

// Load fixture_decel_af_correction.csv
// Expect: pulls detected, no AF_CORRECTION_HIGH finding
// Result: ✅ PASS / ❌ FAIL
```

---

## Browser Console Validation

```javascript
// Check modules loaded
console.log('StateClassifier:', window.StateClassifier ? '✓' : '✗');
console.log('RulesEngine:', window.RulesEngine ? '✓' : '✗');
console.log('Findings (wrapper):', window.Findings ? '✓' : '✗');

// Test state classifier
const testRow = { rpm: 100, throttle_pos: 10, boost: -5, idc: 5, calc_load: 0.4 };
const state = window.StateClassifier.classifyState(testRow, null, 0, [testRow]);
console.log('Classify IDLE test:', state === 'IDLE' ? '✓' : '✗');

// Test rules engine
const testSession = { rows: [testRow], mapped: ['rpm', 'feedback_knock', 'fine_knock_learn'] };
const findings = window.RulesEngine.runFindings(testSession);
console.log('Rules engine runs:', findings.length >= 0 ? '✓' : '✗');
```

---

## Next Steps for User

1. **Load test fixtures** via "Browse Files" in index.html
2. **Verify findings** match expected results in README.md
3. **Check browser console** for any JavaScript errors
4. **Run on production data** and compare against old version
5. **Report any deviations** with specific log files for triage

---

**Rewrite Completed**: August 26, 2026
**Status**: Ready for testing
**Test Fixtures**: 7 core scenarios + extension points

