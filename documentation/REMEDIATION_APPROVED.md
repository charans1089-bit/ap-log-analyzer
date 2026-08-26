# Remediation Implementation - Complete Verdict Table (Revised)

## Updated Verdict Table with Conditions Applied

| Issue | Status | Implementation Notes |
|-------|--------|----------------------|
| 1 | ✅ IMPLEMENT | Change `\|\|` to `&&`; rename local var to `hit`; audit all call sites for shadowing |
| 2 | ❌ REWRITE | Event-tracking: (a) init samples=0, increment after; (b) close when value≈0; (c) dual FBK+FKL; modal state; emit metadata (channel, peak, startTime, endTime, sampleCount, duration, recovered, timeToRecover, deepeningSteps) |
| 3 | ❌ REWRITE | Shape-based CRUISE_NOISE: state==CRUISE && load<1.5 && deepeningSteps==1 && \|peak\|<=1.5 && recovered==true (not value match) |
| 4 | ✅ IMPLEMENT | Unified baro formatter; inject "(UNVALIDATED)" into EVERY boost field in ALL sections if baro missing |
| 5 | ✅ IMPLEMENT | Attach boostAtEvent, boostTarget, boostError, afr, commandedAfr, afrDeviation FIELDS to DAM_BELOW_1 finding (not separate finding) |
| 6 | 🔴 **CRITICAL FIRST** | Finding constructor MUST THROW if any of: timestamp, rpm, gear, boost, load, throttle, state, observed, expected, ruleId is absent. Implement FIRST. |
| 7 | ✅ REJECT | Keep targetRate < -5 as-is; report F04 actual ramp rate if borderline |
| 8a | ✅ IMPLEMENT | Add shared 300ms settling exclusion helper after DECEL_FUEL_CUT and SHIFT; all rules consume it |
| 8b | ✅ IMPLEMENT | Remove unsourced `stddev > 10` and `Math.abs(mean) > 10` thresholds on AF_CORRECTION_1; report mean/stddev descriptively only |
| 9 | ✅ IMPLEMENT | Always read arrayBuffer(); decode windows-1252; hard-fail if knock channels don't map |
| 10 | ✅ IMPLEMENT | Always name both DTC codes: Overboost="P0234 / P226B"; Underboost="P0299 / P226C" |
| **11 (NEW)** | ✅ IMPLEMENT | Pull-start IAT in knock findings; satisfied by Finding constructor #6 |

---

## Implementation Plan

### Phase 0: Foundational (First)
- [ ] **Issue #6**: Implement Finding constructor that throws on missing required fields

### Phase 1: Core Fixes  
- [ ] **Issue #1**: Consecutive-sample windowing with `&&` and `hit` variable
- [ ] **Issue #2**: Event-tracking for knock with metadata
- [ ] **Issue #3**: Shape-based CRUISE_NOISE classification
- [ ] **Issue #8a**: Shared 300ms settling exclusion helper
- [ ] **Issue #8b**: Remove unsourced stddev threshold on Correction 1

### Phase 2: Supporting Fixes
- [ ] **Issue #4**: Baro formatter (UNVALIDATED everywhere)
- [ ] **Issue #5**: Attach cross-ref fields to DAM finding
- [ ] **Issue #9**: Windows-1252 encoding + hard-fail
- [ ] **Issue #10**: DTC codes (both always)
- [ ] **Issue #11**: Confirm pull-start IAT via constructor

### Phase 3: Testing
- [ ] Layer 3: All 10 fixtures (pass/fail + negative assertions)
- [ ] F05 severity = BAD assertion
- [ ] F07 severity = UGLY assertion
- [ ] Negative control: DAM=0.938 → UGLY
- [ ] Byte-for-byte diff on log 3 (run twice)
- [ ] Layer 4: Your 4 production logs (UGLY count must = 0)

---

## Ready to Begin Phase 0 (Finding Constructor)

Proceeding with implementation now.


