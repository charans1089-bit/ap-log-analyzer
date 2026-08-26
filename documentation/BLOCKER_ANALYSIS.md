# Implementation Strategy - Immediate Blockers for Testing

## Current Status
- ✅ Finding constructor framework complete (will enforce full context)
- ✅ DAM rule: Full context implemented
- ✅ AFR rule: Full context implemented  
- ✅ 300ms exclusion window clarified
- ⏳ BOOST rule: Needs context update
- ❌ KNOCK rule: MUST REWRITE (Issue #2 - event-tracking with decay)
- ❌ DAM cross-reference: MUST IMPLEMENT (Issue #5)
- ⏳ Temperature rules: Need context updates
- ⏳ Fuel trim rules: Already gates correctly, needs comment clarification only

## Immediate Blockers for Layer 3 Tests

### BLOCKER 1: Knock Rule (Issue #2) 🔴 CRITICAL
- Current: Counts per-sample (reports 4 events for 1 with decay)
- F01 test will FAIL without rewrite
- **Must implement**: Event-tracking with decay collapse, dual FBK+FKL channels, rich metadata
- **Estimated effort**: 1-2 hours (complex state machine)

### BLOCKER 2: Finding Constructor Context Throws 🔴 CRITICAL
- Once constructor enforces missing fields, EVERY incomplete finding will throw
- Already started on DAM and AFR
- **Remaining**: BOOST, KNOCK, Temperature, Fuel Trim rules (~15 call sites)
- **Can workaround**: Catch throws during test runs, fix systematically

### BLOCKER 3: DAM Cross-Reference (Issue #5) 🟡 IMPORTANT
- F07 test expects cross-reference with boost/AFR
- **Must add**: boostAtEvent, boostTarget, boostError, afr, commandedAfr, afrDeviation fields to DAM finding

## Recommended Action Plan

1. **Fix BOOST rule context** (10 min)
2. **Implement Issue #2: Knock event-tracking rewrite** (1-2 hours) 
3. **Implement Issue #5: DAM cross-reference** (30 min)
4. **Update Temperature rules context** (20 min)
5. **Update Fuel Trim comment** (5 min)
6. **Complete remaining addFinding calls systematically** (30 min)
7. **Run Layer 3 test suite** (catch & fix throws as needed)

## Alternative Fast Path (for immediate testing)

If time is critical:
1. Fix BOOST, KNOCK, DAM cross-ref only
2. Let other incomplete findings throw and fix in batch after
3. This unblocks Layer 3 tests for critical rules

## Decision Needed

Should I:
A) Complete comprehensive refactor (all 20+ sites) - 2-3 hours
B) Fast path (critical rules only) - 1-1.5 hours, then batch fix

**Recommendation**: Option B (fast path) to unblock testing faster, then complete in second pass.

Proceeding with Option B unless instructed otherwise.

