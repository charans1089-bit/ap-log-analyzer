# Remediation Implementation Checkpoint

## Completed Work

### Phase 0: Foundational ✅
- [x] Finding class created (throws on missing required fields)
- [x] reportNotEvaluated() separated (non-standard context)
- [x] reportCannotEvaluate() separated (non-standard context)
- [x] getFullContext() helper created
- [x] DAM rule updated to use full context
- [x] 300ms exclusion window clarified (DECEL_FUEL_CUT + SHIFT, not TIP_IN)

### Architecture Decisions Made ✅
```
Finding constructor THROWS if missing: 
  timestamp, rpm, gear, boost, load, throttle, state, observed, expected, ruleId

Special cases (don't require full context):
  - reportNotEvaluated(): reports WHY rule couldn't run
  - reportCannotEvaluate(): reports monitor data missing
  - GOOD findings: can use sample context from row
```

## Work In Progress (Large Scope)

### Remaining Addending Call Sites: ~20+
**Critical Path (for Layer 3 tests)**:
1. Knock rule (Issue #2) - REWRITE for event-tracking
2. BOOST rule - add state, expected
3. DAM cross-reference (Issue #5) - attach fields to DAM finding
4. AFR rule - add state, expected

**Secondary**:
- All other GOOD/BAD/UGLY findings need full context
- All temporary findings need conversion to proper Finding() calls

## Blockers and Dependencies

1. **Issue #2 (Knock rewrite)** blocks F01, F05, F07 tests
   - Current: counts per-sample, never closes events
   - Needed: event-tracking with decay collapse

2. **Issue #6 (Finding constructor)** doesn't block tests but will EXPOSE incomplete findings
   - Once all call sites updated, constructor will throw on missing context
   - This is "free" validation of coverage

3. **Issue #8a (300ms exclusion)** needs integration into every rule
   - Currently clarified but not integrated yet

## Critical Decision Point

**The remaining work is substantial**: Updating 20+ addFinding calls to use getFullContext().

**Two approaches**:

### Option A: Complete Refactor (Recommended)
- Update all addFinding calls systematically
- Run test suite
- Verify no regressions
- Expected effort: 2-3 hours

### Option B: Strategic Minimal Path (Fastest for testing)
- Update only critical rules for Layer 3 (DAM, AFR, KNOCK, BOOST)
- Document remaining technical debt
- Run tests
- Document what still needs fixing

**Recommendation**: Option A - Complete refactor ensures no hidden incomplete findings remain.

## Next Immediate Actions

Before proceeding, need confirmation:

1. Proceed with complete refactoring of all 20+ addFinding calls? (Yes/No)
2. If yes, should I also implement Issue #2 (knock rewrite) in this pass?
3. After refactoring, run all 4 test phases:
   - Layer 3 all 10 fixtures  
   - F05 severity check (BAD)
   - F07 severity check (UGLY)
   - Negative control (DAM=0.938 → UGLY)
   - Byte-for-byte diff on log 3
   - Layer 4 on 4 real logs (UGLY must = 0)

**Status**: Foundation complete, awaiting direction on scope.

