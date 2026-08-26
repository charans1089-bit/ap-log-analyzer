# AP Log Analyzer - Rewrite Summary

## Overview
Major rewrite of AP Log Analyzer for the 2022 Subaru WRX FA24 DIT, transitioning from threshold-based rules to **state-based classification and rule evaluation**. This eliminates false positives caused by evaluating rules without context about what the engine was actually doing.

## Key Changes

### 1. **New Operating-State Classifier** (`js/state-classifier.js`)
Classifies every sample into exactly one operating state BEFORE any rules run:
- **IDLE**: RPM < 1200, throttle < 5%
- **DECEL_FUEL_CUT**: IDC < 10% or load < 0.5 g/rev, throttle < 25%
- **CRUISE**: boost < 0, throttle 5–60%
- **TIP_IN**: throttle rising > 200%/sec, or boost rising > 15 psi/sec
- **SPOOL**: throttle > 90%, boost rising, not yet within 2 psi of target
- **WOT_STEADY**: throttle > 90%, boost > 4 psi, within 2 psi of target, ≥ 0.3 s sustained
- **SHIFT**: throttle drops > 50% within 0.2 s, RPM > 3000
- **OVERRUN**: throttle < 10%, RPM falling, boost < −5 psi

### 2. **New Rules Engine** (`js/rules-engine.js`)
Complete rewrite of rule logic using state-based gating:
- Rules only fire during appropriate states
- Anti-false-positive gates:
  - Minimum 5 consecutive samples or 0.15 s, whichever is longer
  - 300 ms exclusion window after SHIFT, DECEL_FUEL_CUT, TIP_IN
  - No absolute thresholds where commanded values exist (AFR, boost, fueling)
  
**Rules Rewritten:**
- **AFR_LEAN**: Compare actual vs commanded during WOT_STEADY only, > 0.7 AFR deviation
- **FEEDBACK_KNOCK**: Classify as LOAD_KNOCK (WOT context) or CRUISE_NOISE (-1.05 during cruise)
- **BOOST_OVERSHOOT**: WOT_STEADY only, exclude when target collapsing > 5 psi/sec
- **FUEL_TRIM**: CRUISE state only, exclude DECEL_FUEL_CUT and OVERRUN
- **TEMPERATURE**: IAT during pulls only, oil/coolant thresholds unchanged
- **DAM_BELOW_1**: Unchanged logic (global event)

### 3. **Updated Metrics Module** (`js/metrics.js`)
New WOT pull detection:
- Pull = contiguous SPOOL → WOT_STEADY
- Minimum 1.0 s in WOT_STEADY (not 0.5 s)
- RPM must rise monotonically ≥ 800 RPM
- Reports: gear, RPM span, peak boost, peak load

### 4. **Enhanced Parser** (`js/parser.js`)
- Detects delimiter from header (comma, tab, semicolon)
- Handles degree-symbol encoding (UTF-8 and latin-1)
- **Critical validation**: Hard-fails if feedback_knock or fine_knock_learn not mapped
  - Prevents silent failures where knock channels report zero

### 5. **Backward Compatibility** (`js/findings.js`)
Old findings.js now wraps new RulesEngine for backward compatibility.

## Script Load Order
```html
<script src="js/storage.js"></script>
<script src="js/parser.js"></script>
<script src="js/state-classifier.js"></script>
<script src="js/metrics.js"></script>
<script src="js/rules-engine.js"></script>
<script src="js/findings.js"></script>
<!-- ... rest of scripts ... -->
```

## Major Bug Fixes

### False Positive: AFR Flagged at Fuel-Cut Recovery
**Before**: AFR 15.97 at boost 0.18 psi, commanded 14.70 → flagged as lean
**After**: Only evaluated during WOT_STEADY state; fuel-cut recovery is DECEL_FUEL_CUT (excluded)

### False Positive: Boost Overshoot During Gear Shift
**Before**: Target collapsed 6.98 → 2.50 psi while actual boost held 7 psi → flagged +11.22 psi overshoot
**After**: Exclude samples where target falling > 5 psi/sec; geared correctly means +0.03 psi error

### False Positive: Brief Throttle Stab as WOT Pull
**Before**: 8 samples > 90% throttle, 0.2 s, peak boost 0.4 psi → counted as pull
**After**: Pull requires SPOOL → WOT_STEADY with ≥ 1.0 s in WOT_STEADY; this stab never reaches WOT_STEADY

### Silent Failure: Degree Symbol Encoding
**Before**: "Feedback Knock (°)" as UTF-8 vs header "Feedback Knock (°)" as latin-1 → column doesn't match → knock channels unmapped → report zero knock forever
**After**: Normalize all degree symbols; hard-fail parse if knock columns missing

## Testing & Validation

### Regression Test Fixtures (to be created in `/docs/test/`)
1. **Cruise-only log** → 0 pulls, all WOT rules NOT_EVALUATED
2. **Throttle stab** (8 samples, 0.2 s, 0.4 psi) → 0 pulls detected
3. **Fuel-cut recovery** (AFR 15.97, boost 0.18, cmd 14.70) → no AFR finding
4. **Gearshift target collapse** (boost 5.61, target 2.50) → no overshoot finding
5. **Real load-knock** (FBK −1.05, 9.4 psi, load 2.45, gear 5) → LOAD_KNOCK, informational
6. **High-RPM target ramp** (target 6.98→3.52, actual holds 7) → no overshoot finding
7. **Decel AF Correction** (−25.8% at 1.8% IDC) → no fuel trim finding
8. **Degree-symbol encoding** (latin-1) → knock channels map successfully

## Known Limitations & Future Improvements
- Timing context reporting (minimum timing vs gear/RPM/load) not yet implemented
- Ethanol trend tracking (3-session rolling) not yet implemented
- Per-cell knock severity classification incomplete
- KS Noise channels (chart only, no rules) - future enhancement

## Backward Compatibility
- Old `window.Findings.runFindings()` calls delegate to new RulesEngine
- Session data format unchanged
- UI rendering unchanged
- All existing code continues to work

## References
- Prompt specification file: `/Users/skatta4/IdeaProjects/ap-log-analyzer/Prompt`
- NAMR/Atlas documentation (Appendices A-C in prompt)
- Cobb threshold guidance

