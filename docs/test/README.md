# Regression Test Fixtures

These CSV files are designed to validate critical fixes in the AP Log Analyzer rewrite.

## Test Cases

### 1. fixture_cruise_only.csv
**Expected Result**: 0 WOT pulls, all WOT-dependent rules should be `NOT_EVALUATED`

**Scenario**: Normal cruise driving with no throttle above ~20%. Contains some cruise-noise knock (-1.05°) which should be classified as informational, not a fault.

**Validations**:
- ✅ No pulls detected (no SPOOL→WOT_STEADY transitions)
- ✅ AFR_LEAN rule returns NOT_EVALUATED
- ✅ BOOST_OVERSHOOT rule returns NOT_EVALUATED
- ✅ FEEDBACK_KNOCK_BAD rule returns NOT_EVALUATED
- ✅ CRUISE_KNOCK_NOISE classified as informational
- ✅ DAM held at 1.0 (good)

---

### 2. fixture_throttle_stab.csv
**Expected Result**: 0 WOT pulls detected

**Scenario**: Brief throttle stab - 8 samples at 90%+ throttle (~0.2 seconds), peak boost 0.4 psi. This was historically flagged as a WOT pull.

**Validations**:
- ✅ Pull is NOT detected (never reaches WOT_STEADY sustained for ≥ 1.0 s)
- ✅ AFR_LEAN rule returns NOT_EVALUATED (no pulls)
- ✅ No false pull metrics generated

---

### 3. fixture_fuel_cut_recovery.csv
**Expected Result**: No AFR_LEAN finding

**Scenario**: WOT pull (3+ seconds in WOT_STEADY), followed by throttle lift. During lift, wideband shows AFR 15.97 at boost 0.18 psi with commanded 14.70 - historically flagged as "dangerously lean". However, this is fuel-cut recovery (DECEL_FUEL_CUT state), not WOT.

**Validations**:
- ✅ Pulls are detected (SPOOL→WOT_STEADY sections)
- ✅ AFR 15.97 is NOT flagged as lean (state is DECEL_FUEL_CUT, excluded from evaluation)
- ✅ No incorrect "AFR leaner than commanded by 3.27" finding
- ✅ DAM holds at 1.0

---

### 4. fixture_gearshift_target_collapse.csv
**Expected Result**: No BOOST_OVERSHOOT finding

**Scenario**: During gear shift (throttle drops from 95% to 46%), target boost collapses rapidly (7.0 → 2.5 psi) while actual boost holds at 5.61 psi. This was historically flagged as "+11.22 psi overshoot".

**Validations**:
- ✅ Boost 5.61 vs target 7.0 does NOT trigger overshoot (state transition, target still high)
- ✅ Subsequent samples: target falling rapidly → excluded from evaluation
- ✅ No false "+11 psi overshoot" finding during gear change
- ✅ Error after correction calculated correctly (~0 psi)

---

### 5. fixture_real_load_knock.csv
**Expected Result**: LOAD_KNOCK classified, severity informational (single-step recovery at DAM=1.0)

**Scenario**: Real knock event during WOT. FBK -1.05° at 9.4 psi boost, load 2.45 g/rev, 100% throttle, gear 5, DAM 1.0 (no fallback). Single-step event that recovers immediately.

**Validations**:
- ✅ Pull is detected (4+ seconds, 2500 RPM increase)
- ✅ FBK -1.05° event classified as LOAD_KNOCK (WOT context)
- ✅ Severity set to informational (DAM 1.0, single-step with recovery)
- ✅ Context reported: 9.4 psi, load 2.45, gear 5, RPM 4500→5600
- ✅ Not flagged as "ugly" or "bad" (expected FBK behavior during WOT)

---

### 6. fixture_high_rpm_target_ramp.csv
**Expected Result**: No BOOST_OVERSHOOT finding

**Scenario**: High-RPM pull where target ramps down (6.98 → 3.52 psi from 5000 to 5900 RPM). Actual boost holds around 7.0 psi. Historically flagged as massive overshoot.

**Validations**:
- ✅ Pulls are detected (SPOOL→WOT_STEADY)
- ✅ Boost 7.0 vs target 6.98 initially shows small positive error (~+0.02 psi)
- ✅ When target collapses (5psi/sec > threshold), samples excluded from evaluation
- ✅ No false "massive overshoot" finding
- ✅ Mean error across steady-state window near zero

---

### 7. fixture_decel_af_correction.csv
**Expected Result**: No AF_CORRECTION_HIGH finding

**Scenario**: During coast-down (throttle drops to <10%), AF Correction 1 reads -25.8% at IDC 1.8%. This was historically flagged as excessive fuel trim.

**Validations**:
- ✅ State classified as DECEL_FUEL_CUT (throttle < 10%, load < 0.5)
- ✅ State is excluded from fuel trim evaluation
- ✅ No false "AF Correction -25.8% means MAF issue" finding
- ✅ Correction returns to near 0% once steady-state cruise resumes

---

### 8. fixture_degree_symbol_encoding.csv
**Expected Result**: Knock channels successfully mapped (hard-fail if not)

**Scenario**: CSV with degree symbols in column headers. Tests handling of different character encodings (UTF-8 vs latin-1).

**Validations**:
- ✅ Parser detects degree symbols in header "Feedback Knock (°)" and "Fine Knock Learn (°)"
- ✅ Normalizes encoding variants (UTF-8 U+00B0, latin-1 0xB0)
- ✅ Successfully maps to internal keys `feedback_knock` and `fine_knock_learn`
- ✅ Parse succeeds (not hard-failed)
- ✅ Knock channels contain expected values (not all NaN)

---

## Running Tests

### Manual Testing (Browser)
1. Open `index.html` in browser
2. Load each CSV fixture via "Browse Files" or "Choose Log Folder"
3. Verify findings match expected results in "Session Analysis" dashboard

### Expected Dashboard Results

**fixture_cruise_only.csv**:
- Pull list: (empty)
- Ugly: none
- Bad: none
- Good: DAM Held ✓
- Not Evaluated: AFR_LEAN, BOOST_OVERSHOOT, FEEDBACK_KNOCK_BAD, etc.

**fixture_throttle_stab.csv**:
- Pull list: (empty)
- Ugly: none
- Bad: none
- Good: DAM Held ✓
- Not Evaluated: All WOT rules

**fixture_fuel_cut_recovery.csv**:
- Pull list: Pull 1 (0.000–0.050s, 3000→4000 RPM)
- Ugly: none
- Bad: none
- Good: DAM Held ✓
- Info: No AFR finding for 15.97 AFR

**fixture_gearshift_target_collapse.csv**:
- Pull list: Pull 1 (0.000–0.050s, 3000→4500 RPM)
- Ugly: none
- Bad: none → **NO overshoot finding** ← critical fix
- Good: Boost Control ✓

**fixture_real_load_knock.csv**:
- Pull list: Pull 1 (0.000–0.175s, 3000→6100 RPM)
- Ugly: none
- Bad: none
- Info: CRUISE_KNOCK_NOISE (single-step -1.05°)
- Good: DAM Held ✓

**fixture_high_rpm_target_ramp.csv**:
- Pull list: Pull 1 (0.000–0.175s, 5000→6100 RPM)
- Ugly: none
- Bad: none → **NO overshoot finding** ← critical fix
- Good: Boost Control ✓

**fixture_decel_af_correction.csv**:
- Pull list: (possibly one brief pull at 0.000–0.050s)
- Ugly: none
- Bad: none → **NO AF_CORRECTION_HIGH finding** ← critical fix
- Good: DAM Held ✓

**fixture_degree_symbol_encoding.csv**:
- Parse succeeds (not hard-failed)
- Knock channels populated with real values
- Findings generated successfully

---

## Validation Checklist

Use this to verify implementation:

- [ ] All 8 fixtures parse successfully
- [ ] fixture_cruise_only: 0 pulls, all WOT rules NOT_EVALUATED
- [ ] fixture_throttle_stab: 0 pulls (no WOT_STEADY sustained)
- [ ] fixture_fuel_cut_recovery: No AFR_LEAN finding for AFR 15.97
- [ ] fixture_gearshift_target_collapse: No BOOST_OVERSHOOT finding
- [ ] fixture_real_load_knock: LOAD_KNOCK classified, severity informational
- [ ] fixture_high_rpm_target_ramp: No BOOST_OVERSHOOT finding
- [ ] fixture_decel_af_correction: No AF_CORRECTION_HIGH finding
- [ ] Degree symbols normalized, knock columns mapped

---

## References

- **Prompt specification**: `/Prompt` (comprehensive requirements)
- **Rewrite summary**: `/REWRITE_SUMMARY.md` (implementation overview)
- **State classifier**: `js/state-classifier.js` (operating state logic)
- **Rules engine**: `js/rules-engine.js` (new rule implementations)
- **Parser**: `js/parser.js` (delimiter, encoding fixes)
- **Metrics**: `js/metrics.js` (state-based pull detection)

