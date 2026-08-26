# Issue #6 Implementation Status - Finding Constructor Enforcement

## What's Done
- ✅ Finding class created with THROWING constructor for missing required fields
- ✅ reportNotEvaluated() and reportCannotEvaluate() separated (don't require full context)
- ✅ getFullContext() helper created to extract context from row + state
- ✅ DAM rule updated to use full context

## What's Required
- ⏳ **Remaining: ~20+ addFinding call sites need updating to provide:**
  - timestamp, rpm, gear, boost, load, throttle, state, observed, expected

## Issue #6 Architecture (Correct)
```javascript
class Finding {
  constructor(severity, ruleId, label, message, opts = {}) {
    // THROWS if any of these missing:
    // timestamp, rpm, gear, boost, load, throttle, state, observed, expected, ruleId
  }
}
```

## Critical Path for Layer 3 Tests
To pass F05 and F07 tests, these rules MUST provide full context:
1. **DAM rule** - ✅ DONE (for F07)
2. **Knock rule** - ⏳ IN PROGRESS (for F01, F05)
3. **BOOST rule** - ⏳ NEEDS UPDATE (for F06)
4. **DAM cross-reference** - ⏳ NEEDS IMPLEMENTATION (for F07 + Issue #5)

## Remaining Work List
After critical path, complete these:
- [ ] AFR rule - add state, expected
- [ ] KNOCK rule - rewrite for events, add expected per issue #2
- [ ] BOOST rule - add state, expected
- [ ] TEMP rules - add state
- [ ] Fuel trim rule - add state
- [ ] All GOOD findings - provide sample context

## Next Steps
1. Continue with Knock rule rewrite (Issue #2) which is also critical
2. Implement 300ms exclusion helper (Issue #8a)
3. Complete remaining call sites

**Status**: Issue #6 foundation complete, targeted updates in progress.

