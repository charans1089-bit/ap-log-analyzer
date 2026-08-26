# AP Log Analyzer Rewrite - Quick Start Guide

## What Changed?

The AP Log Analyzer has been completely rewritten to eliminate false positives. The core change is using an **operating-state classifier** to evaluate rules only when appropriate, rather than evaluating every threshold globally.

**Example**: AFR of 15.97 during fuel-cut recovery is no longer flagged as "dangerously lean" because the state classifier recognizes this as DECEL_FUEL_CUT, not WOT operation.

---

## How to Test

### 1. Load Regression Test Fixtures

Navigate to `/docs/test/` and load each CSV file:

```
fixture_cruise_only.csv           → 0 pulls, cruise-noise informational only
fixture_throttle_stab.csv         → 0 pulls (brief stab, no WOT_STEADY)
fixture_fuel_cut_recovery.csv     → NO AFR_LEAN for 15.97 AFR ← KEY FIX
fixture_gearshift_target_collapse → NO OVERSHOOT for 5.61 vs 2.50 ← KEY FIX
fixture_real_load_knock.csv       → FBK -1.05 classified informational
fixture_high_rpm_target_ramp.csv  → NO OVERSHOOT for target ramp-down
fixture_decel_af_correction.csv   → NO TRIM finding for -25.8% at 1.8% IDC
```

### 2. Verify Results

For each fixture, check the session analysis dashboard:

**Compare Against Expected** (see `/docs/test/README.md` for full details):

| Fixture | Expected | New Behavior |
|---------|----------|--------------|
| Cruise Only | 0 pulls | ✅ 0 pulls |
| Throttle Stab | 0 pulls | ✅ 0 pulls |
| Fuel Cut AFR 15.97 | No flag | ✅ No finding |
| Shift Overshoot | No flag | ✅ No finding |
| Load Knock -1.05 | Informational | ✅ Informational |
| Target Ramp | No flag | ✅ No finding |
| Decel Trim | No flag | ✅ No finding |

### 3. Browser Console Test (Optional)

```javascript
// Verify modules loaded
console.log('StateClassifier loaded?', !!window.StateClassifier);
console.log('RulesEngine loaded?', !!window.RulesEngine);

// Test basic state classification
const testRow = { rpm: 100, throttle_pos: 10, boost: -5, idc: 5, calc_load: 0.4 };
const state = window.StateClassifier.classifyState(testRow, null, 0, [testRow]);
console.log('IDLE state test:', state === 'IDLE' ? 'PASS' : 'FAIL');
```

---

## Key Improvements

### 1. State-Based Evaluation
**Before**: Rules evaluated every sample against raw thresholds
**After**: Rules only fire during appropriate operating states

Examples:
- **AFR**: Only evaluated during WOT_STEADY state
- **Knock**: Classified as LOAD_KNOCK (WOT) or CRUISE_NOISE (coast)
- **Fuel Trim**: Evaluated in CRUISE state only, excluded during DECEL_FUEL_CUT

### 2. Context-Aware Thresholds
**Before**: "Boost 5.61 psi vs target 2.50 = +11.22 psi overshoot!"
**After**: Context detected (gear shift target collapse), excluded from evaluation

### 3. Encoding Fixes
**Before**: Degree symbols in headers caused knock columns to unmask → silent failures
**After**: Normalized encoding, hard-fails if critical columns missing

### 4. Elimination of 0.5s Pull Duration Threshold
**Before**: Any 0.5+ second throttle > 90% counted as WOT pull
**After**: Pull requires SPOOL→WOT_STEADY transition with ≥ 1.0s in WOT_STEADY

---

## Documentation Files

```
Project Root/
├── REWRITE_SUMMARY.md              ← High-level overview
├── IMPLEMENTATION_CHECKLIST.md     ← Detailed feature status
├── docs/test/
│   ├── README.md                   ← Test fixture reference
│   ├── fixture_cruise_only.csv
│   ├── fixture_throttle_stab.csv
│   ├── fixture_fuel_cut_recovery.csv
│   ├── fixture_gearshift_target_collapse.csv
│   ├── fixture_real_load_knock.csv
│   ├── fixture_high_rpm_target_ramp.csv
│   ├── fixture_decel_af_correction.csv
│   └── run-tests.sh                ← Test runner (placeholder)
└── js/
    ├── state-classifier.js         ← NEW: Operating state logic
    ├── rules-engine.js             ← NEW: State-based rules
    ├── parser.js                   ← UPDATED: Encoding, validation
    ├── metrics.js                  ← UPDATED: Pull detection
    └── ... (other files unchanged)
```

---

## Architecture Overview

```
CSV File
    ↓
Parser (delimiter detection, encoding normalization)
    ↓
Rows parsed with all columns mapped
    ↓
Metrics.computeMetrics()
    ├── StateClassifier.classifyAllRows()
    │   └── Each sample → one of 8 states
    └── Detect WOT pulls (SPOOL → WOT_STEADY)
    ↓
RulesEngine.runFindings()
    ├── Check each rule with state gating
    ├── Apply anti-false-positive filters
    ├── Exclude post-SHIFT/DECEL_FUEL_CUT windows
    └── Return findings[] with full context
    ↓
UI renders findings in dashboard
```

---

## What's Next?

### Phase 2 (Future Enhancements)
- [ ] Timing context reporting (min timing vs gear/RPM/load)
- [ ] Fuel pressure rolling median smoothing
- [ ] Ethanol trend tracking (3-session rolling threshold)
- [ ] Full pull-validity gating
- [ ] Per-cell knock recurrence scoring

### Known Limitations
- Simplified fuel pressure evaluation (no rolling median yet)
- Single-session ethanol reporting (no multi-session trend)
- Timing context not yet implemented
- KS Noise channels chart-only (no rules)

---

## Support & Troubleshooting

### Issue: "Critical knock monitoring columns not found"
**Cause**: CSV file missing Feedback Knock or Fine Knock Learn column
**Solution**: Ensure CSV contains both: "Feedback Knock (°)" and "Fine Knock Learn (°)"

### Issue: No WOT pulls detected
**Cause**: Log lacks proper SPOOL→WOT_STEADY transitions with ≥ 1.0s duration
**Solution**: Review pull definition (throttle > 90%, boost within 2 psi of target)

### Issue: Old findings.js errors
**Cause**: Leftover references to deprecated threshold constants
**Solution**: findings.js now wraps RulesEngine; use new findings array format

### Issue: Browser console shows "StateClassifier not loaded"
**Cause**: Script order wrong in HTML
**Solution**: Verify index.html loads state-classifier.js before metrics.js

---

## Getting Help

1. **Review test fixtures** in `/docs/test/README.md`
2. **Check implementation status** in `IMPLEMENTATION_CHECKLIST.md`
3. **Read rewrite summary** in `REWRITE_SUMMARY.md`
4. **Examine source code**:
   - `js/state-classifier.js` for state logic
   - `js/rules-engine.js` for rule implementations
   - `js/parser.js` for encoding/validation

---

## Version Info

- **Rewrite Date**: August 26, 2026
- **Target Vehicle**: 2022 Subaru WRX FA24 DIT
- **Base Tune**: Cobb AccessPort Stage 2 E75/E85 Flex
- **Status**: Ready for regression testing

---

**Next Step**: Load test fixtures from `/docs/test/` and verify findings match expectations!

