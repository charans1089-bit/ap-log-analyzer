'use strict';

const COLUMN_DEFS = {
  time:                 { name: 'Time (sec)',                    unit: 's',    aliases: ['Time', 'Time(sec)', 'Time (s)'] },
  af_correction_1:      { name: 'AF Correction 1 (%)',           unit: '%',    aliases: ['AF Corr 1', 'Short Term Fuel Trim', 'STFT'] },
  af_learning_1:        { name: 'AF Learning 1 (%)',             unit: '%',    aliases: ['AF Learn 1', 'Long Term Fuel Trim', 'LTFT'] },
  afr:                  { name: 'AF Sens 1 Ratio (AFR)',         unit: 'afr',  aliases: ['AF Sens 1 Ratio', 'Air/Fuel Ratio', 'Wideband AFR', 'A/F Ratio'] },
  avcs_exh_left:        { name: 'AVCS Exh Left (\u00b0)',         unit: 'deg',  aliases: ['AVCS Exh Left'] },
  avcs_exh_right:       { name: 'AVCS Exh Right (\u00b0)',        unit: 'deg',  aliases: ['AVCS Exh Right'] },
  avcs_in_left:         { name: 'AVCS In Left (\u00b0)',          unit: 'deg',  aliases: ['AVCS In Left'] },
  avcs_in_right:        { name: 'AVCS In Right (\u00b0)',         unit: 'deg',  aliases: ['AVCS In Right'] },
  accel_pos:            { name: 'Accel Position (%)',            unit: '%',    aliases: ['Accelerator Position', 'Accel Pos', 'Pedal Position'] },
  baro:                 { name: 'Baro Pressure (psi)',           unit: 'psi',  aliases: ['Barometric Pressure', 'Baro Pressure', 'Baro'] },
  boost:                { name: 'Boost (psi)',                   unit: 'psi',  aliases: ['Manifold Pressure (psi)', 'MAP (psi)', 'Boost Pressure'] },
  cl_fuel_target:       { name: 'CL Fuel Target (AFR)',          unit: 'afr',  aliases: ['CL Target', 'Closed Loop Target'] },
  calc_load:            { name: 'Calculated Load (g/rev)',       unit: 'g/rev',aliases: ['Engine Load', 'Load (g/rev)', 'Load'] },
  comm_fuel_final:      { name: 'Comm Fuel Final (AFR)',         unit: 'afr',  aliases: ['Commanded Fuel', 'Comm Fuel'] },
  coolant_temp:         { name: 'Coolant Temp (F)',              unit: 'F',    aliases: ['ECT', 'Engine Coolant Temp', 'Coolant Temperature'] },
  dam:                  { name: 'Dyn Adv Mult (DAM)',            unit: '',     aliases: ['DAM', 'Dynamic Advance Multiplier', 'Dynamic Adv Mult'] },
  egr_commanded:        { name: 'EGR Commanded (steps)',         unit: '',     aliases: ['EGR Steps', 'EGR'] },
  ethanol_final:        { name: 'Ethanol Conc FINAL (%)',        unit: '%',    aliases: ['Ethanol Conc Final', 'Ethanol Content'] },
  ethanol_raw:          { name: 'Ethanol Conc RAW (%)',          unit: '%',    aliases: ['Ethanol Conc Raw', 'Ethanol Raw'] },
  feedback_knock:       { name: 'Feedback Knock (\u00b0)',        unit: 'deg',  aliases: ['Feedback Knock Correction', 'FBK', 'Knock Correction'] },
  fine_knock_learn:     { name: 'Fine Knock Learn (\u00b0)',      unit: 'deg',  aliases: ['Fine Knock Learning', 'FKL'] },
  gear:                 { name: 'Gear Position (gear)',          unit: '',     aliases: ['Gear', 'Current Gear'] },
  ign_comp_iat:         { name: 'Ign Comp IAT (\u00b0)',          unit: 'deg',  aliases: ['IAT Ignition Compensation', 'Ign Comp IAT'] },
  ignition_timing:      { name: 'Ignition Timing (\u00b0)',       unit: 'deg',  aliases: ['Ignition Advance', 'Spark Advance', 'Timing'] },
  inj_duty_cycle:       { name: 'Inj Duty Cycle (%)',            unit: '%',    aliases: ['IDC', 'Injector Duty Cycle', 'Injector DC'] },
  inj_timing_eoi:       { name: 'Inj Timing H EOI NEW (\u00b0)',  unit: 'deg',  aliases: ['EOI', 'End of Injection'] },
  inj_timing_soi:       { name: 'Inj Timing H SOI NEW (\u00b0)',  unit: 'deg',  aliases: ['SOI', 'Start of Injection'] },
  intake_temp:          { name: 'Intake Temp (F)',               unit: 'F',    aliases: ['IAT', 'Intake Air Temp', 'Intake Air Temperature'] },
  intake_temp_manifold: { name: 'Intake Temp Manifold (F)',      unit: 'F',    aliases: ['IAT Manifold', 'Manifold IAT', 'Manifold Temp'] },
  ks_noise_cyl1:        { name: 'KS Noise Cyl 1 (raw)',          unit: '',     aliases: ['Knock Sensor Cyl 1', 'KS1'] },
  ks_noise_cyl2:        { name: 'KS Noise Cyl 2 (raw)',          unit: '',     aliases: ['Knock Sensor Cyl 2', 'KS2'] },
  ks_noise_cyl3:        { name: 'KS Noise Cyl 3 (raw)',          unit: '',     aliases: ['Knock Sensor Cyl 3', 'KS3'] },
  ks_noise_cyl4:        { name: 'KS Noise Cyl 4 (raw)',          unit: '',     aliases: ['Knock Sensor Cyl 4', 'KS4'] },
  maf_corr_final:       { name: 'MAF Corr Final (g/s)',          unit: 'g/s',  aliases: ['MAF', 'Mass Air Flow', 'MAF Corrected'] },
  maf_freq:             { name: 'MAF Freq (kHz)',                unit: 'kHz',  aliases: ['MAF Frequency', 'MAF Freq'] },
  oil_temp:             { name: 'Oil Temp (F)',                  unit: 'F',    aliases: ['Engine Oil Temp', 'Oil Temperature'] },
  rpm:                  { name: 'RPM (RPM)',                     unit: 'rpm',  aliases: ['Engine Speed', 'Engine RPM', 'RPM'] },
  req_torque:           { name: 'Req Torque (Nm)',               unit: 'Nm',   aliases: ['Requested Torque', 'Torque Request', 'Req Torque'] },
  roughness_cyl1:       { name: 'Roughness Cyl 1 (count)',       unit: '',     aliases: ['Misfire Cyl 1', 'Roughness 1'] },
  roughness_cyl2:       { name: 'Roughness Cyl 2 (count)',       unit: '',     aliases: ['Misfire Cyl 2', 'Roughness 2'] },
  roughness_cyl3:       { name: 'Roughness Cyl 3 (count)',       unit: '',     aliases: ['Misfire Cyl 3', 'Roughness 3'] },
  roughness_cyl4:       { name: 'Roughness Cyl 4 (count)',       unit: '',     aliases: ['Misfire Cyl 4', 'Roughness 4'] },
  fuel_press:           { name: 'Sns Fuel Press MONITOR (psi)',  unit: 'psi',  aliases: ['Fuel Pressure', 'Fuel Press', 'Sensor Fuel Pressure'] },
  td_prop_wg_corr:      { name: 'TD Prop WG Pos Corr (mm)',      unit: 'mm',   aliases: ['WG Prop Correction', 'Proportional WG Correction'] },
  tgv_map_ratio:        { name: 'TGV Map Ratio (mult)',          unit: '',     aliases: ['TGV Ratio', 'TGV Map'] },
  boost_target:         { name: 'Target Boost Final Rel (psi)',  unit: 'psi',  aliases: ['Boost Target', 'Target Boost', 'Desired Boost'] },
  throttle_pos:         { name: 'Throttle Pos (%)',              unit: '%',    aliases: ['Throttle Position', 'TPS'] },
  wg_init_pos:          { name: 'Wastegate Init Pos Final (mm)', unit: 'mm',   aliases: ['WG Init Pos', 'Wastegate Init'] },
  wg_pos_actual:        { name: 'Wastegate Pos Actual (mm)',     unit: 'mm',   aliases: ['WG Actual', 'Wastegate Actual'] },
  wg_pos_comm:          { name: 'Wastegate Pos Comm (mm)',       unit: 'mm',   aliases: ['WG Commanded', 'Wastegate Comm'] },
  wg_pos_learn_corr:    { name: 'Wastegate Pos Learn Corr (mm)', unit: 'mm',  aliases: ['WG Learn Corr', 'Wastegate Learn Corr'] },
};

const RECOMMENDED_MONITORS = [
  'time', 'rpm', 'throttle_pos', 'boost', 'boost_target', 'afr',
  'comm_fuel_final', 'feedback_knock', 'fine_knock_learn', 'dam',
  'calc_load', 'ethanol_final', 'intake_temp', 'oil_temp', 'fuel_press',
  'inj_duty_cycle', 'gear', 'wg_pos_comm', 'wg_pos_actual',
  'roughness_cyl1', 'roughness_cyl2', 'roughness_cyl3', 'roughness_cyl4'
];

function detectDelimiter(headerLine) {
  if (headerLine.includes('\t')) return '\t';
  if (headerLine.includes(',')) return ',';
  return ';';
}

function parseApInfo(rawHeader) {
  const m = rawHeader.match(/AP Info:\[(.*)\]/);
  return m ? m[1].trim() : rawHeader.replace(/^AP Info:/, '').trim();
}

/**
 * Normalize degree symbols from different encodings (UTF-8, latin-1)
 * Handles: ° (UTF-8 U+00B0), ° (latin-1 0xB0)
 */
function normalizeDegreeSymbols(s) {
  // Replace all variants of degree symbol
  return s
    .replace(/\u00b0/g, '°')  // UTF-8
    .replace(/°/g, '°');      // Ensure consistent symbol
}

function normKey(s) {
  const normalized = normalizeDegreeSymbols(s);
  return normalized.toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/, '')  // strip trailing (unit)
    .replace(/[\u00b0\s]+$/, '')       // strip trailing degree + spaces
    .replace(/°/g, '')                  // also strip our standardized degree
    .trim();
}

async function parseFile(file) {
  try {
    const text = await file.text();
    
    // iCloud detection
    if (file.size === 0 || !text || text.trim() === '' || text.match(/\.icloud/)) {
      return { ok: false, error: { code: 'ICLOUD_PLACEHOLDER', message: 'This file may not be downloaded from iCloud. In Finder, right-click it and choose Download Now.' }, session: null, summary: null };
    }

    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) {
      return { ok: false, error: { code: 'EMPTY_FILE', message: 'File contains no data.' }, session: null, summary: null };
    }

    const headerLine = lines[0];
    const delimiter = detectDelimiter(headerLine);
    const rawHeaders = headerLine.split(delimiter);
    
    // First data row field count validation
    const firstRowData = lines[1].split(delimiter);
    if (rawHeaders.length !== firstRowData.length) {
      return { ok: false, error: { code: 'FIELD_COUNT_MISMATCH', message: `Header has ${rawHeaders.length} fields but first data row has ${firstRowData.length} fields. Refusing to parse.` }, session: null, summary: null };
    }

    // Extract AP Info
    const apInfoRaw = rawHeaders[rawHeaders.length - 1] || '';
    const apInfo = apInfoRaw.includes('AP Info:') ? parseApInfo(apInfoRaw) : '';
    const tuneName = apInfo ? apInfo.split('|').pop().trim() : '';

    // Original data headers (excluding AP Info)
    const hasApInfo = apInfoRaw.includes('AP Info:');
    const headers = hasApInfo ? rawHeaders.slice(0, -1) : rawHeaders;

    const columnKeys = [];
    const mapped = [];
    const unmapped = [];

    // Map headers to internal keys
    headers.forEach(originalHeader => {
      const normHeader = normKey(originalHeader);
      let matchedKey = '';

      for (const [key, def] of Object.entries(COLUMN_DEFS)) {
        // Critical Alias Rules
        if (normHeader === 'lambda' && key === 'afr') continue;
        if ((normHeader === 'af correction' || normHeader === 'af corr') && key === 'af_learning_1') continue;

        if (normHeader === normKey(def.name)) {
          matchedKey = key;
          break;
        }

        const aliasMatch = def.aliases.some(alias => normKey(alias) === normHeader);
        if (aliasMatch) {
          matchedKey = key;
          break;
        }
      }

      if (matchedKey) {
        columnKeys.push(matchedKey);
        mapped.push(matchedKey);
      } else {
        columnKeys.push('');
        unmapped.push(originalHeader);
      }
    });

     const missingRecommended = RECOMMENDED_MONITORS.filter(rm => !mapped.includes(rm));

    // CRITICAL VALIDATION: Feedback Knock and Fine Knock Learn must be mapped
    // If not, the entire log is unreliable for knock analysis
    const hasFeedbackKnock = mapped.includes('feedback_knock');
    const hasFineKnockLearn = mapped.includes('fine_knock_learn');
    
    if (!hasFeedbackKnock || !hasFineKnockLearn) {
      return { ok: false, error: { code: 'CRITICAL_COLUMNS_MISSING', message: `Critical knock monitoring columns not found: Feedback Knock ${hasFeedbackKnock ? '✓' : '✗'}, Fine Knock Learn ${hasFineKnockLearn ? '✓' : '✗'}. Cannot reliably analyze this log.` }, session: null, summary: null };
    }

    const rows = [];
    let rowsParsed = 0;
    let rowsSkipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const lineFields = lines[i].split(delimiter);
      if (lineFields.length !== rawHeaders.length) {
        rowsSkipped++;
        continue;
      }

      const row = { _index: rowsParsed };
      
      // Initialize all COLUMN_DEFS keys to NaN
      for (const key of Object.keys(COLUMN_DEFS)) {
        row[key] = NaN;
      }

      const dataFields = hasApInfo ? lineFields.slice(0, -1) : lineFields;

      headers.forEach((originalHeader, idx) => {
        const val = parseFloat(dataFields[idx]);
        const key = columnKeys[idx];
        if (key) {
          row[key] = isNaN(val) ? NaN : val;
        } else {
          row[originalHeader] = isNaN(val) ? NaN : val; // store unmapped
        }
      });

      rows.push(row);
      rowsParsed++;
    }

    let durationSec = 0;
    let avgIntervalSec = 0;
    let minIntervalSec = Infinity;
    let maxIntervalSec = -Infinity;

    if (rows.length > 0 && !isNaN(rows[0].time) && !isNaN(rows[rows.length - 1].time)) {
      durationSec = rows[rows.length - 1].time - rows[0].time;
      let totalDelta = 0;
      let validDeltas = 0;

      for (let i = 1; i < rows.length; i++) {
        const t0 = rows[i - 1].time;
        const t1 = rows[i].time;
        if (!isNaN(t0) && !isNaN(t1)) {
          const delta = t1 - t0;
          totalDelta += delta;
          validDeltas++;
          if (delta < minIntervalSec) minIntervalSec = delta;
          if (delta > maxIntervalSec) maxIntervalSec = delta;
        }
      }

      if (validDeltas > 0) {
        avgIntervalSec = totalDelta / validDeltas;
      } else {
        minIntervalSec = 0;
        maxIntervalSec = 0;
      }
    } else {
      minIntervalSec = 0;
      maxIntervalSec = 0;
    }

    if (minIntervalSec === Infinity) minIntervalSec = 0;
    if (maxIntervalSec === -Infinity) maxIntervalSec = 0;

    const session = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      filename: file.name || 'unknown.csv',
      loadedAt: Date.now(),
      apInfo,
      tuneName,
      delimiter,
      headers,
      columnKeys,
      mapped,
      unmapped,
      missingRecommended,
      rows,
      rowsParsed,
      rowsSkipped,
      durationSec,
      avgIntervalSec,
      minIntervalSec,
      maxIntervalSec,
      pulls: [],
      stats: null
    };

    const summary = {
      filename: session.filename,
      rowsParsed,
      rowsSkipped,
      durationSec,
      avgIntervalSec,
      minIntervalSec,
      maxIntervalSec,
      mapped,
      unmapped,
      missingRecommended
    };

    return { ok: true, error: null, session, summary };

  } catch (err) {
    return { ok: false, error: { code: 'PARSE_ERROR', message: err.message }, session: null, summary: null };
  }
}

window.Parser = { parseFile, COLUMN_DEFS, RECOMMENDED_MONITORS };
