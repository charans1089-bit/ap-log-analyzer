# Remediation Fix Verdicts - Pre-Implementation Review

## Verdict Table

| Issue | My Proposed Fix | Your Correction | Rationale | Status |
|-------|-----------------|-----------------|-----------|--------|
| 1 | `(sampleCount >= min \|\| duration >= minDur)` | Change `\|\|` to `&&` (AND not OR) | Spec says "5 samples OR 0.15s WHICHEVER IS LONGER" = both must hold. `&&` enforces both. | ✅ ACCEPT |
| 1 | Use `findConsecutiveWindow(...)` variable name | Rename to `hit` to avoid shadowing global `window` | Variable shadowing causes `window.StateClassifier` ReferenceError inside predicate. | ✅ ACCEPT |
| 1 | No audit of other call sites | Check all `findConsecutiveWindow()` call sites for shadowing | Prevent cascading shadowing bugs. | ✅ ACCEPT |
| 2 | Event-tracking state machine (basic version) | **REWRITE with 3 bug fixes**: (a) samples counter init, (b) event closure logic, (c) dual-channel (FBK + FKL) | Current version: double-counts initial sample, never closes events, misses FKL patterns. (a) Initialize samples=0, increment AFTER; (b) Close when value returns to ≈0; (c) Run identically on both knock channels. | ❌ REJECT, REWRITE |
| 2 | Track state at first sample | Modal state across event + emit rich metadata | event.state should be MODE (most common state), not snapshot. Emit: channel, peak, startTime, endTime, sampleCount, duration, recovered, timeToRecover, deepeningSteps. deepeningSteps > 1 = GENUINE; single-step = NOISE-LIKE. | ✅ ACCEPT |
| 3 | Match -1.05 with floating-point tolerance | **Shape-based classification, not value match** | Don't use `Math.abs(fbk - (-1.05)) < 0.01`. Instead classify CRUISE_NOISE by: state==CRUISE && load<1.5 && deepeningSteps==1 && \|peak\|<=1.5 && recovered==true. Survives -1.06, -0.70, etc. | ❌ REJECT, REWRITE |
| 4 | Add "(UNVALIDATED)" message per finding | **Implement as formatter, not string concat. Mark EVERY boost figure in ALL sections if baro missing** | Cosmetic string addition misses the point. GOOD section saying "Boost tracked within X" without baro is forbidden. Need unified formatter to inject "(UNVALIDATED)" into boost fields everywhere. | ✅ ACCEPT |
| 5 | Emit separate info finding for cross-ref | **Attach fields to DAM_BELOW_1 itself, not separate finding** | Spec says "report TOGETHER". Attach boostAtEvent, boostTarget, boostError, afr, commandedAfr, afrDeviation as FIELDS on DAM finding. | ✅ ACCEPT |
| 6 | Implement context helper function | **PROMOTE TO CRITICAL. Make Finding constructor throw if any field missing** | Helpers are optional (devs forget). Throw structurally impossible to emit incomplete. Constructor MUST THROW if any of: timestamp, rpm, gear, boost, load, throttle, state, observed, expected, ruleId is absent. | ✅ ACCEPT (now CRITICAL #6) |
| 7 | Change >5 to 4.9 threshold | **REJECT entirely. Keep targetRate < -5.** | Unsourced literal, widens exclusion, hides real overshoots. If F04 borderline, measure and report actual ramp rate from fixture, stop. | ✅ ACCEPT REJECTION |
| 8 | Add OVERRUN exclusion | **First re-read actual fuel trim rule, quote current gating, then propose change** | My description contradicted my code snippet. Need to understand current logic before proposing. | ⏳ PENDING REVIEW |
| 9 | Decode latin-1 on file.text() mismatch | **Always read arrayBuffer(). Decode windows-1252. Hard-fail if knock channels don't map (Part 1).** | file.text() UTF-8 misread becomes U+FFFD (replacement char), not recoverable. Use arrayBuffer + windows-1252. Hard-fail path must be reachable and tested. | ✅ ACCEPT |
| 10 | Select DTC by error magnitude | **Do not discriminate. Name both: Overboost → "P0234 / P226B". Underboost → "P0299 / P226C".** | DTC mapping by magnitude is invented. Always name both codes. | ✅ ACCEPT |

---

## Issue 8 Resolution: Fuel Trim Rule Review

Let me first read the actual current fuel trim gating before proposing changes:

**Current fuel trim rule** (rules-engine.js lines 369-390):

```javascript
if (!hasColumn(session, 'af_correction_1')) {
  reportCannotEvaluate('AF_CORRECTION_1', 'A/F Correction 1', 'Monitor af_correction_1 not logged.');
} else {
  // Evaluate CRUISE state only, exclude DECEL_FUEL_CUT
  const correction_windows = [];
  
  for (let i = 0; i < rows.length; i++) {
    const state = activeStates[i];
    if (state === window.StateClassifier.STATES.CRUISE) {
      const val = rows[i].af_correction_1;
      if (isDataValid(rows[i], 'af_correction_1')) {
        correction_windows.push({ idx: i, val });
      }
    }
  }
  
  if (correction_windows.length > 0) {
    const mean = correction_windows.reduce((s, w) => s + w.val, 0) / correction_windows.length;
    const stddev = Math.sqrt(
      correction_windows.reduce((s, w) => s + Math.pow(w.val - mean, 2), 0) / correction_windows.length
    );
    
    if (Math.abs(mean) > 10 || stddev > 10) {
      addFinding('bad', 'AF_CORRECTION_HIGH', 'Fuel trim correction excessive',
        `A/F Correction 1 mean ${mean.toFixed(1)}% ± ${stddev.toFixed(1)}% in cruise. Tune may need MAF calibration or injector inspection.`,
        { metric: 'af_correction_1', value: mean }
      );
    }
  }
}
```

**Current gating analysis**:
- ✅ Already gates to CRUISE state only (line: `if (state === window.StateClassifier.STATES.CRUISE)`)
- ✅ Already calculates mean and stddev for cruise window
- ❌ **OVERRUN NOT explicitly excluded** - However, since OVERRUN has `throttle < 10%, RPM falling, boost < -5`, and CRUISE has `boost < 0, throttle 5-60%`, the overlap would be throttle between 5-10% with boost < -5. Current code doesn't explicitly check for OVERRUN, so it might include marginal cases.

**Spec requirement** (Part 3.5): "Exclude DECEL_FUEL_CUT and OVERRUN entirely."

**Current state**: Excludes DECEL_FUEL_CUT ✅, but doesn't explicitly exclude OVERRUN ❌

**Proposed fix for Issue 8**:
```javascript
for (let i = 0; i < rows.length; i++) {
  const state = activeStates[i];
  // Evaluate CRUISE state ONLY; explicitly exclude OVERRUN
  if (state === window.StateClassifier.STATES.CRUISE &&
      state !== window.StateClassifier.STATES.OVERRUN) {  // ← Redundant but explicit
    // ... rest of logic
  }
}
```

Actually, wait - the condition `if (state === CRUISE)` already excludes OVERRUN because a sample can't be in two states simultaneously. The issue is **the comment is misleading** - it says "exclude DECEL_FUEL_CUT" but the code doesn't show that check. The actual exclusion happens by gate `state === CRUISE` which implicitly excludes everything else.

**My verdict for Issue 8**: Current code already excludes OVERRUN through state gating. The comment should clarify that CRUISE state implicitly excludes DECEL_FUEL_CUT and OVERRUN. **MINOR: Update comment clarity, no logic change needed.**

---

## Summary for Approval

| Category | Count | Action |
|----------|-------|--------|
| Accept Your Corrections | 10 | Implement as specified |
| Reject My Proposals | 2 | Issue 7 (keep as-is), Issue 3 (rewrite) |
| Pending Issue 8 | 1 | Already correct (clarify comment) |
| Promote to CRITICAL | 1 | Issue 6 (Finding constructor) |
| **Total Issues to Fix** | **11** | |

---

## Ready for Implementation?

**Please confirm**:
1. ✅ Verdict table accepted?
2. ✅ Issue 8 (fuel trim already correct, clarify comment)?
3. ✅ Ready to proceed with corrected implementations?

If approved, I will:
1. Implement all 11 corrected fixes
2. Re-run all 10 Layer 3 fixtures (report pass/fail + negative assertions)
3. Run Layer 4 on your 4 real production logs (UGLY count must = 0)
4. Byte-for-byte diff test on log 3
5. Report detailed results before declaring readiness


