# Recommended AccessPort Monitor List

## Core Monitors (required for all rules)

These monitors MUST be logged for the analyzer to properly evaluate all rules. Missing any of these may result in skipped checks or incomplete diagnostics.

| Monitor Name | Internal Key | Why Needed |
|---|---|---|
| Time (sec) | time | Required to track event duration and log progression. |
| RPM (RPM) | rpm | Core reference for engine speed and determining load regions. |
| Throttle Pos (%) | tps | Used to identify Wide-Open Throttle (WOT) pulls. |
| Boost (psi) | boost | Measures manifold pressure to identify high-load scenarios. |
| Target Boost Final Rel (psi) | target_boost | Compared against actual Boost to check for overboosting. |
| AF Sens 1 Ratio (AFR) | afr | Primary wideband reading to ensure the car isn't running lean. |
| Comm Fuel Final (AFR) | comm_fuel | What the ECU requests; compared against AFR. |
| Feedback Knock (°) | fbk | Immediate timing correction; indicates active knock. |
| Fine Knock Learn (°) | fkl | Learned timing correction; indicates historical knock in a given RPM/load range. |
| Dyn Adv Mult (DAM) | dam | Global timing adjustment multiplier. Drops below 1.0 indicate serious knock events. |
| Calculated Load (g/rev) | load | Represents cylinder filling and engine strain. |
| Ethanol Conc FINAL (%) | eth | Crucial for flex-fuel tunes to ensure correct ethanol content reading. |
| Intake Temp (F) | iat | Identifies heat-soak and poor intercooler performance. |
| Oil Temp (F) | oil | Tracks engine heat and lubrication limits. |
| Sns Fuel Press MONITOR (psi) | fuel_p | Used to identify fuel starvation or HPFP drops under load. |
| Inj Duty Cycle (%) | inj_dc | Ensures injectors are not maxed out. |
| Gear Position (gear) | gear | Used to identify lugging (high load, low RPM, high gear). |
| Wastegate Pos Comm (mm) | wg_comm | Expected position of the electronic wastegate. |
| Wastegate Pos Actual (mm) | wg_act | Actual position of the wastegate; compared against commanded. |
| Roughness Cyl 1-4 (count) | roughness | Identifies misfires across the four cylinders. |

## Second-Tier Monitors (additional diagnostics)

These monitors provide excellent supplementary data for manual review, though they are not strictly required for the core automated analysis rules.

| Monitor Name | Internal Key | Why Needed |
|---|---|---|
| AF Correction 1 (%) | afc | Immediate short-term fuel trim adjustments. |
| AF Learning 1 (%) | afl | Long-term fuel trim adjustments. Identifies mechanical intake/vacuum issues. |
| AVCS Exh/In Left/Right (°) | avcs | Variable valve timing angles. Good for checking AVCS operation. |
| Baro Pressure (psi) | baro | Atmospheric pressure, affects baseline turbo calculations. |
| Coolant Temp (F) | coolant | Engine operating temperature. |
| EGR Commanded (steps) | egr | Exhaust Gas Recirculation valve position. |
| Ethanol Conc RAW (%) | eth_raw | Pre-filtered ethanol sensor reading. |
| Ignition Timing (°) | ign | Final timing value after all corrections. |
| Intake Temp Manifold (F) | iat_man | Temp at the manifold, usually hotter than pre-throttle IAT. |
| KS Noise Cyl 1-4 (raw) | ks_noise | Raw knock sensor noise; used by tuners to set knock thresholds. |
| MAF Corr Final (g/s) | maf | Mass Airflow in grams per second. |
| Req Torque (Nm) | req_tq | ECU's requested torque based on pedal mapping. |
| TD Prop WG Pos Corr (mm) | td_wg | Turbo Dynamics proportional wastegate correction. |
| TGV Map Ratio (mult) | tgv | Tumble Generator Valve position ratio. |
| Wastegate Init Pos Final (mm) | wg_init | Baseline wastegate position before corrections. |
| Wastegate Pos Learn Corr (mm) | wg_learn | Long-term learned wastegate adjustments. |

## How to Configure

1. Plug your AccessPort into your OBD2 port and turn the ignition to ON (engine running or off).
2. Go to **Gauges**.
3. Push up on the directional pad to access the menu.
4. Select **Setup** -> **Configure Datalogging**.
5. Scroll through the list and press the center button to check/uncheck monitors until your list matches the **Core Monitors** (and any Second-Tier monitors you desire).
6. Press the left button to exit and save.
