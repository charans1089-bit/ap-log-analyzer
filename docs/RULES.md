# Findings Rules Reference

## Thresholds

| Constant | Value | Unit |
|----------|-------|------|
| DAM_MIN | 1.0 | — |
| FEEDBACK_KNOCK_UGLY | −4.0 | ° |
| FEEDBACK_KNOCK_BAD | −1.0 | ° |
| FINE_KNOCK_LEARN_UGLY | −2.0 | ° |
| AFR_LEAN_UGLY | 12.5 | AFR |
| INJ_DUTY_UGLY | 90 | % |
| AF_LEARNING_BAD | ±10 | % |
| BOOST_OVERSHOOT_BAD | +2 | psi |
| IAT_BAD | 120 | °F |
| OIL_TEMP_BAD | 250 | °F |
| FUEL_PRESS_DROP_PCT | 15 | % |
| LOAD_LUGE | 2.0 | g/rev |
| WG_TRACKING | 2 | mm |
| ROUGHNESS | > 0 | count |

## Rules

### UGLY — Act Before Next Drive

#### DAM_BELOW_1
**Threshold:** DAM < 1.0  
**Rationale:** Dynamic Advance Multiplier (DAM) represents the ECU's global ignition timing adjustment based on perceived knock severity. A drop below 1.0 indicates the engine has experienced significant or sustained knock events and is actively pulling timing to protect itself. You should investigate fueling and mechanical health before doing another WOT pull.

#### FEEDBACK_KNOCK_UGLY
**Threshold:** Feedback Knock ≤ −4.0°  
**Rationale:** Feedback knock is the immediate timing reduction in response to a knock event. A large correction of -4.0° or more indicates a severe detonation event. Immediate investigation is required to avoid potential ringland or bearing failure.

#### FINE_KNOCK_LEARN_UGLY
**Threshold:** Fine Knock Learn ≤ −2.0° (during WOT pull)  
**Rationale:** Fine Knock Learn (FKL) is applied predictively to specific RPM/Load ranges based on past knock. If FKL exceeds -2.0° under load, it means the ECU has repeatedly seen knock in this cell and is pulling significant power to compensate. A tune revision or fuel quality check is needed.

#### AFR_LEAN_UGLY
**Threshold:** > 12.5 AFR (when boost > 0, RPM > 4000)  
**Rationale:** Air/Fuel Ratio under high boost needs to be rich to provide cooling and prevent detonation. Running leaner than 12.5 AFR under significant load is dangerous and highly prone to causing catastrophic engine failure. Check for vacuum/boost leaks or failing fueling components immediately.

#### INJ_DUTY_UGLY
**Threshold:** Injector Duty Cycle > 90%  
**Rationale:** Injector duty cycle measures how long the fuel injectors stay open during a combustion cycle. Exceeding 90% means the injectors are nearly maxed out, leaving no safety margin if weather gets colder or boost spikes. Upgraded injectors or reduced power targets are necessary.

### BAD — Needs Attention

#### FEEDBACK_KNOCK_BAD
**Threshold:** Feedback Knock between −1.0° and −4.0° (under load)  
**Rationale:** Minor feedback knock (-1.41° to -2.81°) can sometimes be false knock from drivetrain noise, but under load it often indicates mild real detonation. Keep an eye on it; if it happens consistently in the same RPM range, a tune adjustment is warranted.

#### AF_LEARNING_BAD
**Threshold:** AF Learning 1 outside ±10%  
**Rationale:** AF Learning is the long-term fuel trim the ECU applies based on O2 sensor feedback. Drifting beyond ±10% suggests a mechanical issue like a post-MAF intake leak, bad front O2 sensor, or changes in fuel density. 

#### BOOST_OVERSHOOT_BAD
**Threshold:** Boost > Target Boost + 2 psi (sustained)  
**Rationale:** Brief boost spikes on spool are common, but sustained overboosting exceeds the MAP sensor's resolution or the fuel system's capacity, risking engine damage. This is often caused by a mechanical issue with the wastegate, pill restrictor, or an aggressive tune.

#### IAT_BAD
**Threshold:** Intake Temp (IAT) > 120°F during pull  
**Rationale:** High intake air temperatures reduce air density and drastically increase the likelihood of detonation. Above 120°F, the ECU will pull timing to save the engine, resulting in significant power loss. An upgraded intercooler may be needed.

#### OIL_TEMP_BAD
**Threshold:** Oil Temp > 250°F  
**Rationale:** Modern synthetic oils degrade rapidly past 250°F, losing viscosity and bearing protection. If you routinely hit this threshold during tracking or hard driving, an oil cooler is strongly recommended to protect engine bearings.

#### FUEL_PRESS_DROP_BAD
**Threshold:** 15% drop from pre-pull baseline during WOT  
**Rationale:** High Pressure Fuel Pump (HPFP) pressure should remain relatively stable or rise under load. A 15% drop indicates the pump cannot keep up with the fuel volume demanded by the injectors, risking a sudden lean condition.

#### LOAD_LUGE_BAD
**Threshold:** Calculated Load < 2.0 g/rev below 2500 RPM (especially high gear)  
**Rationale:** High load at low RPM in high gears causes Low-Speed Pre-Ignition (LSPI), which is incredibly destructive to connecting rods. Downshift to keep RPMs up when demanding high torque.

#### WG_TRACKING_BAD
**Threshold:** Wastegate Pos Comm vs Actual divergence > 2mm sustained > 0.5s  
**Rationale:** If the wastegate actual position differs significantly from the commanded position, it points to a physical binding in the wastegate actuator linkage or a failing electronic actuator. This can lead to dangerous overboost or underboost conditions.

#### ROUGHNESS_BAD
**Threshold:** Roughness Cyl 1-4 > 0 during WOT  
**Rationale:** Roughness monitors misfires. A count greater than 0 under heavy load indicates misfires are occurring, which can quickly destroy catalytic converters or indicate ignition system failures (plugs/coils).

## Intentionally NOT Implemented

- **KS Noise threshold**: Raw knock sensor noise has no meaningful absolute threshold. The ECU scales and filters this value based on engine RPM and physical noise baseline, which varies widely between engines. Any static rule for raw knock noise would produce constant false positives or be utterly useless, so we do not evaluate it.
