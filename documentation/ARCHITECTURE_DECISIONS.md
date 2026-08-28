# Architecture Decisions & Unification Target

## Decision 1: Operating State Gating vs Global Severity (Knock & Critical Timing)

### Context & Problem
In the current split codebase:
- The **Rules Engine / Analyzer** (`js/rules-engine.js`) evaluates severe knock (`isUgly`: `FBK <= -4.0°` or `FBK <= -2.0°` unrecovered) as **intentionally state-independent**. Severe detonation is treated as an urgent safety defect regardless of whether the car is in `CRUISE`, `TIP_IN`, `SPOOL`, or `WOT_STEADY`.
- The **Report Generator** (`report-generator.js`), after commit `7bf8e7c`, strictly gates all knock counting and timing retard warnings behind `isWotEval` (`state === WOT_STEADY && !inExclusion`). As a result, non-WOT knock events (such as `sample_log.csv`'s −4.22° FBK during tip-in, or `fixture_ugly_knock_non_wot.csv`) are discarded by the Report Generator while flagged as `ugly` by the Analyzer.

### Recorded Decision & Direction for Unification
- **`isUgly` remains state-independent:** Knock worse than −4.0° is urgent in any operating state.
- **Unification Target:** When the Report Generator and Rules Engine are unified into a single pipeline, the Report Generator will adopt the Analyzer's severity model. Severe knock occurring outside WOT will not be discarded as benign; it will escalate the report's verdict to critical/ugly alert.
- **Reference Fixture:** `docs/test/fixture_ugly_knock_non_wot.csv` (F15) is the deterministic regression fixture and primary acceptance test for this unification requirement.
