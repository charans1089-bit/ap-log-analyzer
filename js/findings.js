'use strict';

const THRESHOLDS = {
  DAM_MIN:               1.0,    // below this = Ugly
  FEEDBACK_KNOCK_UGLY:   -4.0,   // at or beyond = Ugly
  FEEDBACK_KNOCK_BAD:    -1.0,   // between -1 and UGLY threshold = Bad (under load)
  FINE_KNOCK_LEARN_UGLY: -2.0,   // worse than this during WOT pull = Ugly
  AFR_LEAN_UGLY:         12.5,   // leaner than this = Ugly (when boost>0 and RPM>4000)
  AFR_BOOST_THRESHOLD:   0.0,    // boost must be above this for AFR rules
  AFR_RPM_THRESHOLD:     4000,   // RPM must be above this for AFR lean Ugly rule
  AFR_MIN_RPM:           2500,   // minimum RPM for any AFR rule
  INJ_DUTY_UGLY:         90.0,   // above = Ugly
  AF_LEARNING_BAD:       10.0,   // |af_learning_1| beyond this = Bad
  BOOST_OVERSHOOT_BAD:   2.0,    // boost exceeds target by more than this psi = Bad
  BOOST_OVERSHOOT_MIN_DURATION: 0.5, // must be sustained for this many seconds
  IAT_BAD:               120.0,  // above during pull = Bad (Fahrenheit)
  OIL_TEMP_BAD:          250.0,  // above = Bad (Fahrenheit)
  FUEL_PRESS_DROP_PCT:   15.0,   // drop more than this % from pre-pull = Bad
  LOAD_LUGE:             2.0,    // above this below 2500 RPM = Bad (lugging)
  LUGE_RPM_MAX:          2500,
};

function hasColumn(session, key) {
  return session.mapped && session.mapped.includes(key);
}

function runFindings(session) {
  const findings = [];
  let findingCount = 0;
  
  function addFinding(sev, rule, label, msg, metric, ts, rpm, val, pullIdx = null) {
    findings.push({
      id: `${rule.toLowerCase()}_${++findingCount}`,
      severity: sev,
      ruleId: rule,
      label: label,
      message: msg,
      metric: metric,
      timestamp: ts !== undefined ? ts : null,
      rpm: rpm !== undefined ? rpm : null,
      value: val !== undefined ? val : null,
      pullIndex: pullIdx !== undefined ? pullIdx : null
    });
  }

  function allNaN(rows, key) {
    return rows.every(r => Number.isNaN(r[key]));
  }

  const rows = session.rows || [];
  const pulls = session.pulls || [];

  // UGLY 1: DAM_BELOW_1
  if (!hasColumn(session, 'dam')) {
    addFinding('cannot_evaluate', 'DAM_BELOW_1', 'DAM evaluation failed', 'Cannot evaluate DAM_BELOW_1 — dam not logged.', 'dam');
  } else if (allNaN(rows, 'dam')) {
    addFinding('cannot_evaluate', 'DAM_BELOW_1', 'DAM evaluation failed', 'DAM not logged.', 'dam');
  } else {
    let worst = null;
    let allGood = true;
    for (let r of rows) {
      if (Number.isFinite(r.dam)) {
        if (r.dam < THRESHOLDS.DAM_MIN) {
          allGood = false;
          if (!worst || r.dam < worst.dam) worst = r;
        }
      }
    }
    if (worst) {
      addFinding('ugly', 'DAM_BELOW_1', 'DAM dropped below 1.0', 
        `DAM < 1.0 means ECU detected sustained knock and reduced ignition advance globally. Address before driving hard. (Worst: ${worst.dam} at ${worst.time}s, ${worst.rpm} RPM)`, 
        'dam', worst.time, worst.rpm, worst.dam);
    }
    
    // GOOD 15: DAM_HELD
    if (allGood) {
      addFinding('good', 'DAM_HELD', 'DAM held at 1.0', 'DAM held at 1.0 throughout the session. The ECU detected no sustained knock requiring global advance reduction. Good.', 'dam');
    }
  }

  // UGLY 2 & BAD 6: FEEDBACK_KNOCK
  if (!hasColumn(session, 'feedback_knock')) {
    addFinding('cannot_evaluate', 'FEEDBACK_KNOCK_UGLY', 'Feedback knock evaluation failed', 'Cannot evaluate FEEDBACK_KNOCK_UGLY — feedback_knock not logged.', 'feedback_knock');
    addFinding('cannot_evaluate', 'FEEDBACK_KNOCK_BAD', 'Feedback knock evaluation failed', 'Cannot evaluate FEEDBACK_KNOCK_BAD — feedback_knock not logged.', 'feedback_knock');
    addFinding('cannot_evaluate', 'ZERO_KNOCK', 'Zero knock evaluation failed', 'Cannot evaluate ZERO_KNOCK — feedback_knock not logged.', 'feedback_knock');
  } else {
    let worstUgly = null;
    let worstBad = null;
    
    for (let r of rows) {
      let fbk = r.feedback_knock;
      if (Number.isFinite(fbk)) {
        if (fbk <= THRESHOLDS.FEEDBACK_KNOCK_UGLY) {
          if (!worstUgly || fbk < worstUgly.feedback_knock) worstUgly = r;
        } else if (fbk < THRESHOLDS.FEEDBACK_KNOCK_BAD && r.calc_load > 1.0) {
          if (!worstBad || fbk < worstBad.feedback_knock) worstBad = r;
        }
      }
    }
    if (worstUgly) {
      addFinding('ugly', 'FEEDBACK_KNOCK_UGLY', 'Significant feedback knock detected',
        `Feedback knock reached ${worstUgly.feedback_knock}° at ${worstUgly.time} sec / ${worstUgly.rpm} RPM. This is the ECU's real-time knock correction. Values at or below −4° indicate the ECU is hearing significant knock.`,
        'feedback_knock', worstUgly.time, worstUgly.rpm, worstUgly.feedback_knock);
    }
    if (worstBad) {
      addFinding('bad', 'FEEDBACK_KNOCK_BAD', 'Feedback knock under load',
        `Feedback knock reached ${worstBad.feedback_knock}° at ${worstBad.time} sec / ${worstBad.rpm} RPM. Values between −1° and −3° under load are worth noting. Per tuner guidance, corrections around −3° or less are generally not alarming but should be monitored.`,
        'feedback_knock', worstBad.time, worstBad.rpm, worstBad.feedback_knock);
    }
    
    // GOOD 16: ZERO_KNOCK
    let hasWotKnock = false;
    for (let p of pulls) {
      for (let i = p.startIdx; i <= p.endIdx; i++) {
        let fbk = rows[i].feedback_knock;
        if (Number.isFinite(fbk) && Math.abs(fbk) >= 1.0) {
          hasWotKnock = true; break;
        }
      }
    }
    if (!hasWotKnock && pulls.length > 0) {
      addFinding('good', 'ZERO_KNOCK', 'No significant knock', 'No significant feedback knock detected across all WOT pulls. Clean pull(s).', 'feedback_knock');
    }
  }

  // UGLY 3: FINE_KNOCK_LEARN_UGLY
  if (!hasColumn(session, 'fine_knock_learn')) {
    addFinding('cannot_evaluate', 'FINE_KNOCK_LEARN_UGLY', 'Fine knock learn evaluation failed', 'Cannot evaluate FINE_KNOCK_LEARN_UGLY — fine_knock_learn not logged.', 'fine_knock_learn');
  } else {
    for (let p of pulls) {
      let worst = null;
      for (let i = p.startIdx; i <= p.endIdx; i++) {
        let r = rows[i];
        if (Number.isFinite(r.fine_knock_learn) && r.fine_knock_learn < THRESHOLDS.FINE_KNOCK_LEARN_UGLY) {
          if (!worst || r.fine_knock_learn < worst.fine_knock_learn) worst = r;
        }
      }
      if (worst) {
        addFinding('ugly', 'FINE_KNOCK_LEARN_UGLY', 'High fine knock learn',
          `Fine Knock Learn reached ${worst.fine_knock_learn}° during pull #${p.index}. FKL is a persistent learned correction. Values worse than −2° during WOT indicate the ECU has learned knock in this load/RPM cell.`,
          'fine_knock_learn', worst.time, worst.rpm, worst.fine_knock_learn, p.index);
      }
    }
  }

  // UGLY 4: AFR_LEAN_UGLY
  if (!hasColumn(session, 'afr') || !hasColumn(session, 'boost') || !hasColumn(session, 'rpm')) {
    addFinding('cannot_evaluate', 'AFR_LEAN_UGLY', 'AFR Lean evaluation failed', 'Cannot evaluate AFR_LEAN_UGLY — afr, boost or rpm not logged.', 'afr');
  } else {
    let worst = null;
    for (let r of rows) {
      if (r.boost > THRESHOLDS.AFR_BOOST_THRESHOLD && r.rpm > THRESHOLDS.AFR_RPM_THRESHOLD && r.afr > THRESHOLDS.AFR_LEAN_UGLY) {
        if (!worst || r.afr > worst.afr) worst = r;
      }
    }
    if (worst) {
      addFinding('ugly', 'AFR_LEAN_UGLY', 'Lean AFR under boost',
        `AFR reached ${worst.afr}:1 at ${worst.time} sec / ${worst.rpm} RPM under boost. Lean mixture under high-boost conditions risks detonation and piston damage. Target is typically 11.5–12.0 AFR at WOT.`,
        'afr', worst.time, worst.rpm, worst.afr);
    }
  }

  // UGLY 5: INJ_DUTY_UGLY
  if (!hasColumn(session, 'inj_duty_cycle')) {
    addFinding('cannot_evaluate', 'INJ_DUTY_UGLY', 'Injector duty evaluation failed', 'Cannot evaluate INJ_DUTY_UGLY — inj_duty_cycle not logged.', 'inj_duty_cycle');
  } else {
    let worst = null;
    for (let r of rows) {
      if (r.inj_duty_cycle > THRESHOLDS.INJ_DUTY_UGLY) {
        if (!worst || r.inj_duty_cycle > worst.inj_duty_cycle) worst = r;
      }
    }
    if (worst) {
      addFinding('ugly', 'INJ_DUTY_UGLY', 'Injector duty cycle maxed',
        `Injector duty cycle reached ${worst.inj_duty_cycle}% at ${worst.time} sec / ${worst.rpm} RPM. Above 90%, injectors cannot deliver more fuel. This is a hard limit; the engine will run lean regardless of tune.`,
        'inj_duty_cycle', worst.time, worst.rpm, worst.inj_duty_cycle);
    }
  }

  // BAD 7: AF_LEARNING_BAD
  if (!hasColumn(session, 'af_learning_1')) {
    addFinding('cannot_evaluate', 'AF_LEARNING_BAD', 'AF Learning evaluation failed', 'Cannot evaluate AF_LEARNING_BAD — af_learning_1 not logged.', 'af_learning_1');
  } else {
    let worst = null;
    for (let r of rows) {
      if (Math.abs(r.af_learning_1) > THRESHOLDS.AF_LEARNING_BAD) {
        if (!worst || Math.abs(r.af_learning_1) > Math.abs(worst.af_learning_1)) worst = r;
      }
    }
    if (worst) {
      addFinding('bad', 'AF_LEARNING_BAD', 'High AF Learning',
        `AF Learning 1 reached ${worst.af_learning_1}% (long-term fuel trim). Beyond ±10% indicates the ECU is making significant learned fuel corrections. This may indicate a vacuum leak, injector issue, or tune mismatch.`,
        'af_learning_1', worst.time, worst.rpm, worst.af_learning_1);
    }
  }

  // BAD 8: BOOST_OVERSHOOT_BAD
  if (!hasColumn(session, 'boost') || !hasColumn(session, 'boost_target')) {
    addFinding('cannot_evaluate', 'BOOST_OVERSHOOT_BAD', 'Boost overshoot evaluation failed', 'Cannot evaluate BOOST_OVERSHOOT_BAD — boost or boost_target not logged.', 'boost');
  } else if (allNaN(rows, 'boost_target')) {
    addFinding('cannot_evaluate', 'BOOST_OVERSHOOT_BAD', 'Target Boost not logged', 'Target Boost not logged', 'boost');
  } else {
    let startOvershootTime = null;
    let worstOvershoot = 0;
    let worstRow = null;
    
    for (let i = 0; i < rows.length; i++) {
      let r = rows[i];
      let overshoot = r.boost - r.boost_target;
      if (overshoot > THRESHOLDS.BOOST_OVERSHOOT_BAD) {
        if (startOvershootTime === null) startOvershootTime = r.time;
        if (overshoot > worstOvershoot) {
          worstOvershoot = overshoot;
          worstRow = r;
        }
      } else {
        if (startOvershootTime !== null) {
          let duration = rows[i-1].time - startOvershootTime;
          if (duration >= THRESHOLDS.BOOST_OVERSHOOT_MIN_DURATION) {
            addFinding('bad', 'BOOST_OVERSHOOT_BAD', 'Sustained boost overshoot',
              `Boost exceeded target by ${worstOvershoot.toFixed(2)} psi (boost=${worstRow.boost}, target=${worstRow.boost_target}) for ${duration.toFixed(2)} seconds. Sustained overshoot strains the internals and may indicate a wastegate control issue.`,
              'boost', worstRow.time, worstRow.rpm, worstOvershoot);
          }
          startOvershootTime = null;
          worstOvershoot = 0;
          worstRow = null;
        }
      }
    }
  }

  // BAD 9: WG_TRACKING
  if (!hasColumn(session, 'wg_pos_actual') || !hasColumn(session, 'wg_pos_comm')) {
    addFinding('cannot_evaluate', 'WG_TRACKING', 'Wastegate tracking evaluation failed', 'Cannot evaluate WG_TRACKING — wg_pos_actual or wg_pos_comm not logged.', 'wg_pos_actual');
  } else {
    for (let p of pulls) {
      let startDivergeTime = null;
      let worstDiverge = 0;
      let worstRow = null;
      for (let i = p.startIdx; i <= p.endIdx; i++) {
        let r = rows[i];
        let diff = Math.abs(r.wg_pos_actual - r.wg_pos_comm);
        if (diff > 2.0) {
          if (startDivergeTime === null) startDivergeTime = r.time;
          if (diff > worstDiverge) {
            worstDiverge = diff;
            worstRow = r;
          }
        } else {
          if (startDivergeTime !== null) {
            let duration = rows[i-1].time - startDivergeTime;
            if (duration > 0.5) {
              addFinding('bad', 'WG_TRACKING', 'Wastegate tracking error',
                `Wastegate actual position diverged from commanded by ${worstDiverge.toFixed(2)} mm during pull #${p.index}. Persistent divergence indicates the wastegate actuator may not be tracking commanded position, leading to uncontrolled boost.`,
                'wg_pos_actual', worstRow.time, worstRow.rpm, worstDiverge, p.index);
            }
            startDivergeTime = null;
            worstDiverge = 0;
            worstRow = null;
          }
        }
      }
      if (startDivergeTime !== null) {
        let duration = rows[p.endIdx].time - startDivergeTime;
        if (duration > 0.5) {
          addFinding('bad', 'WG_TRACKING', 'Wastegate tracking error',
            `Wastegate actual position diverged from commanded by ${worstDiverge.toFixed(2)} mm during pull #${p.index}. Persistent divergence indicates the wastegate actuator may not be tracking commanded position, leading to uncontrolled boost.`,
            'wg_pos_actual', worstRow.time, worstRow.rpm, worstDiverge, p.index);
        }
      }
    }
  }

  // BAD 10: IAT_BAD
  if (!hasColumn(session, 'intake_temp')) {
    addFinding('cannot_evaluate', 'IAT_BAD', 'IAT evaluation failed', 'Cannot evaluate IAT_BAD — intake_temp not logged.', 'intake_temp');
  } else {
    for (let p of pulls) {
      let worst = null;
      for (let i = p.startIdx; i <= p.endIdx; i++) {
        let r = rows[i];
        if (r.intake_temp > THRESHOLDS.IAT_BAD) {
          if (!worst || r.intake_temp > worst.intake_temp) worst = r;
        }
      }
      if (worst) {
        addFinding('bad', 'IAT_BAD', 'High intake temp',
          `Intake temp reached ${worst.intake_temp}°F during pull #${p.index}. High intake temps reduce air density and increase knock risk. Consider checking intercooler efficiency.`,
          'intake_temp', worst.time, worst.rpm, worst.intake_temp, p.index);
      }
    }
  }

  // BAD 11: OIL_TEMP_BAD
  if (!hasColumn(session, 'oil_temp')) {
    addFinding('cannot_evaluate', 'OIL_TEMP_BAD', 'Oil Temp evaluation failed', 'Cannot evaluate OIL_TEMP_BAD — oil_temp not logged.', 'oil_temp');
  } else {
    let worst = null;
    for (let r of rows) {
      if (r.oil_temp > THRESHOLDS.OIL_TEMP_BAD) {
        if (!worst || r.oil_temp > worst.oil_temp) worst = r;
      }
    }
    if (worst) {
      addFinding('bad', 'OIL_TEMP_BAD', 'High oil temp',
        `Oil temp reached ${worst.oil_temp}°F. Above 250°F, oil begins to break down and lose viscosity. Check cooling and oil condition.`,
        'oil_temp', worst.time, worst.rpm, worst.oil_temp);
    }
  }

  // BAD 12: FUEL_PRESS_DROP_BAD
  if (!hasColumn(session, 'fuel_press')) {
    addFinding('cannot_evaluate', 'FUEL_PRESS_DROP_BAD', 'Fuel Pressure evaluation failed', 'Cannot evaluate FUEL_PRESS_DROP_BAD — fuel_press not logged.', 'fuel_press');
  } else if (allNaN(rows, 'fuel_press')) {
    addFinding('cannot_evaluate', 'FUEL_PRESS_DROP_BAD', 'Fuel Pressure evaluation failed', 'Cannot evaluate FUEL_PRESS_DROP_BAD — fuel_press not logged.', 'fuel_press');
  } else {
    for (let p of pulls) {
      let startRow = rows[p.startIdx];
      let baselineTime = startRow.time - 0.5;
      let baselineRowIdx = p.startIdx;
      while (baselineRowIdx > 0 && rows[baselineRowIdx].time > baselineTime) {
        baselineRowIdx--;
      }
      let baseline = rows[baselineRowIdx].fuel_press;
      
      let worstDrop = 0;
      let worstRow = null;
      for (let i = p.startIdx; i <= p.endIdx; i++) {
        let r = rows[i];
        if (Number.isFinite(baseline) && Number.isFinite(r.fuel_press)) {
          let dropPct = ((baseline - r.fuel_press) / baseline) * 100;
          if (dropPct > THRESHOLDS.FUEL_PRESS_DROP_PCT) {
            if (dropPct > worstDrop) {
              worstDrop = dropPct;
              worstRow = r;
            }
          }
        }
      }
      if (worstRow) {
        addFinding('bad', 'FUEL_PRESS_DROP_BAD', 'Fuel pressure dropped',
          `Fuel pressure dropped ${worstDrop.toFixed(1)}% (from ${baseline.toFixed(1)} psi to ${worstRow.fuel_press.toFixed(1)} psi) during pull #${p.index}. A pressure drop during WOT may indicate fuel supply limitation, particularly on high ethanol content where injector demand is higher.`,
          'fuel_press', worstRow.time, worstRow.rpm, worstRow.fuel_press, p.index);
      }
    }
  }

  // BAD 13: ROUGHNESS_BAD
  for (let cyl = 1; cyl <= 4; cyl++) {
    let col = `roughness_cyl${cyl}`;
    if (!hasColumn(session, col)) {
      addFinding('cannot_evaluate', `ROUGHNESS_CYL${cyl}`, `Roughness Cyl${cyl} evaluation failed`, `Cannot evaluate ROUGHNESS_CYL${cyl} — ${col} not logged.`, col);
    } else {
      for (let p of pulls) {
        let maxCount = 0;
        let worstRow = null;
        for (let i = p.startIdx; i <= p.endIdx; i++) {
          let r = rows[i];
          if (r[col] > maxCount) {
            maxCount = r[col];
            worstRow = r;
          }
        }
        if (maxCount > 0) {
          addFinding('bad', `ROUGHNESS_CYL${cyl}`, `Cylinder ${cyl} roughness`,
            `Cylinder ${cyl} roughness count non-zero (${maxCount} counts) during pull #${p.index} at ${worstRow.time} sec. Cylinder roughness during WOT indicates combustion instability in that cylinder.`,
            col, worstRow.time, worstRow.rpm, maxCount, p.index);
        }
      }
    }
  }

  // BAD 14: LUGGING_BAD
  if (!hasColumn(session, 'calc_load') || !hasColumn(session, 'rpm') || !hasColumn(session, 'gear')) {
    addFinding('cannot_evaluate', 'LUGGING_BAD', 'Lugging evaluation failed', 'Cannot evaluate LUGGING_BAD — calc_load, rpm or gear not logged.', 'calc_load');
  } else {
    let worst = null;
    for (let r of rows) {
      if (r.calc_load > THRESHOLDS.LOAD_LUGE && r.rpm < THRESHOLDS.LUGE_RPM_MAX && r.gear >= 3) {
        if (!worst || r.calc_load > worst.calc_load) worst = r;
      }
    }
    if (worst) {
      addFinding('bad', 'LUGGING_BAD', 'Engine lugging detected',
        `High load (${worst.calc_load} g/rev) at low RPM (${worst.rpm} RPM, gear ${worst.gear}) detected. Lugging the engine under load at low RPM can cause detonation and bearing wear. Downshift.`,
        'calc_load', worst.time, worst.rpm, worst.calc_load);
    }
  }

  // GOOD 17: AFR_TRACKING
  if (!hasColumn(session, 'afr') || !hasColumn(session, 'comm_fuel_final')) {
    addFinding('cannot_evaluate', 'AFR_TRACKING', 'AFR Tracking evaluation failed', 'Cannot evaluate AFR_TRACKING — afr or comm_fuel_final not logged.', 'afr');
  } else {
    for (let p of pulls) {
      let maxDev = 0;
      for (let i = p.startIdx; i <= p.endIdx; i++) {
        let r = rows[i];
        let dev = Math.abs(r.afr - r.comm_fuel_final);
        if (Number.isFinite(dev) && dev > maxDev) maxDev = dev;
      }
      if (maxDev < 0.5 && p.startIdx < p.endIdx) {
        addFinding('good', 'AFR_TRACKING', 'AFR tracks commanded',
          `AFR tracked commanded fuel within ${maxDev.toFixed(2)} AFR across pull #${p.index}.`,
          'afr', null, null, maxDev, p.index);
      }
    }
  }

  // GOOD 18: BOOST_TO_REDLINE
  if (!hasColumn(session, 'boost')) {
    addFinding('cannot_evaluate', 'BOOST_TO_REDLINE', 'Boost hold evaluation failed', 'Cannot evaluate BOOST_TO_REDLINE — boost not logged.', 'boost');
  } else {
    for (let p of pulls) {
      if (p.endIdx - p.startIdx < 10) continue; 
      let peakBoost = p.peakBoost || 0;
      let last20PctIdx = Math.floor(p.startIdx + (p.endIdx - p.startIdx) * 0.8);
      let tapers = false;
      for (let i = last20PctIdx; i <= p.endIdx; i++) {
        if (peakBoost - rows[i].boost > 2.0) {
          tapers = true; break;
        }
      }
      if (!tapers) {
        addFinding('good', 'BOOST_TO_REDLINE', 'Boost held to redline',
          `Boost held to redline without significant taper in pull #${p.index}.`,
          'boost', null, null, null, p.index);
      }
    }
  }

  // GOOD 19: ETHANOL_STABLE
  if (!hasColumn(session, 'ethanol_final')) {
    addFinding('cannot_evaluate', 'ETHANOL_STABLE', 'Ethanol stability evaluation failed', 'Cannot evaluate ETHANOL_STABLE — ethanol_final not logged.', 'ethanol_final');
  } else {
    let minE = Infinity, maxE = -Infinity;
    for (let r of rows) {
      if (Number.isFinite(r.ethanol_final)) {
        if (r.ethanol_final < minE) minE = r.ethanol_final;
        if (r.ethanol_final > maxE) maxE = r.ethanol_final;
      }
    }
    if (minE !== Infinity && (maxE - minE) < 3.0) {
      addFinding('good', 'ETHANOL_STABLE', 'Stable ethanol content',
        `Ethanol content stable at ~${((minE+maxE)/2).toFixed(1)}% throughout the session.`,
        'ethanol_final', null, null, maxE - minE);
    }
  }

  return findings;
}

window.Findings = { runFindings, THRESHOLDS };
