/**
 * DATALOG REPORT GENERATOR - CORE CONTROLLER & PARSER
 * Local-First IndexedDB, 8-Bit Web Audio, Telemetry Parser, Verdict Evaluator
 */

'use strict';

(function() {

  // ==========================================================
  // 1. WEB AUDIO API SYNTHESIZER (8-Bit Retro Sound Effects)
  // ==========================================================
  let audioCtx = null;
  let soundEnabled = true;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playTone(freq, type, duration, startVol = 0.15, endVol = 0.001) {
    if (!soundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(startVol, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(endVol, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  const SoundFX = {
    click: () => playTone(880, 'square', 0.05, 0.08),
    scan: () => {
      if (!soundEnabled) return;
      try {
        initAudio();
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } catch (e) {}
    },
    good: () => {
      playTone(523.25, 'triangle', 0.1, 0.12);
      setTimeout(() => playTone(659.25, 'triangle', 0.1, 0.12), 100);
      setTimeout(() => playTone(783.99, 'triangle', 0.25, 0.15), 200);
    },
    warn: () => {
      playTone(330, 'sawtooth', 0.15, 0.15);
      setTimeout(() => playTone(293.66, 'sawtooth', 0.25, 0.15), 150);
    },
    hazard: () => {
      playTone(180, 'sawtooth', 0.2, 0.2);
      setTimeout(() => playTone(150, 'sawtooth', 0.3, 0.2), 200);
    },
    delete: () => {
      playTone(400, 'square', 0.08, 0.1);
      setTimeout(() => playTone(200, 'square', 0.15, 0.1), 80);
    }
  };

  // ==========================================================
  // 1B. 8-BIT RETRO SYNTHWAVE / CHIPTUNE BGM SEQUENCER
  // ==========================================================
  const NOTE_FREQ = {
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77,
    '0': 0 // Rest
  };

  const CHIPTUNE_TRACKS = [
    {
      name: "Cyber Turbo FA24",
      genre: "Synthwave Chiptune (128 BPM)",
      bpm: 128,
      lead: ['A4', '0', 'C5', 'D5', 'E5', '0', 'D5', 'C5', 'A4', '0', 'G4', 'A4', 'E4', '0', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'E5', 'D5', 'C5', 'D5', 'E5', '0', 'D5', 'C5', 'A4', '0', '0', '0'],
      bass: ['A3', 'A3', 'A3', 'A3', 'F3', 'F3', 'F3', 'F3', 'C3', 'C3', 'C3', 'C3', 'G3', 'G3', 'G3', 'G3', 'A3', 'A3', 'A3', 'A3', 'F3', 'F3', 'F3', 'F3', 'C3', 'C3', 'C3', 'C3', 'E3', 'E3', 'G3', 'G3'],
      arp:  ['E4', 'A4', 'C5', 'E5', 'C4', 'F4', 'A4', 'C5', 'G3', 'C4', 'E4', 'G4', 'D4', 'G4', 'B4', 'D5', 'E4', 'A4', 'C5', 'E5', 'C4', 'F4', 'A4', 'C5', 'G3', 'C4', 'E4', 'G4', 'E4', 'G4', 'B4', 'E5']
    },
    {
      name: "Midnight Outrun Cruise",
      genre: "80s Retrowave (110 BPM)",
      bpm: 110,
      lead: ['E4', 'G4', 'A4', '0', 'B4', '0', 'A4', 'G4', 'E4', '0', 'D4', 'E4', 'G4', '0', 'A4', '0', 'C5', '0', 'B4', 'A4', 'G4', 'E4', 'G4', 'A4', 'B4', '0', 'A4', 'G4', 'E4', '0', '0', '0'],
      bass: ['E3', '0', 'E3', 'E3', 'C3', '0', 'C3', 'C3', 'G3', '0', 'G3', 'G3', 'D3', '0', 'D3', 'D3', 'E3', '0', 'E3', 'E3', 'C3', '0', 'C3', 'C3', 'G3', '0', 'G3', 'G3', 'B3', '0', 'B3', 'B3'],
      arp:  ['B4', 'E5', 'G5', 'B5', 'A4', 'C5', 'E5', 'A5', 'G4', 'B4', 'D5', 'G5', 'F4', 'A4', 'C5', 'F5', 'B4', 'E5', 'G5', 'B5', 'A4', 'C5', 'E5', 'A5', 'G4', 'B4', 'D5', 'G5', 'B4', 'D5', 'F5', 'B5']
    },
    {
      name: "Arcade Stage Clear",
      genre: "Classic 8-Bit Arcade (140 BPM)",
      bpm: 140,
      lead: ['C5', 'C5', 'C5', '0', 'C5', '0', 'D5', '0', 'E5', '0', 'C5', '0', 'D5', '0', 'G5', '0', 'E5', '0', 'F5', 'E5', 'D5', 'C5', 'D5', '0', 'C5', '0', '0', '0', 'C5', '0', '0', '0'],
      bass: ['C3', 'G3', 'C3', 'G3', 'F3', 'C4', 'F3', 'C4', 'G3', 'D4', 'G3', 'D4', 'C3', 'G3', 'C3', 'G3', 'A3', 'E4', 'A3', 'E4', 'F3', 'C4', 'F3', 'C4', 'G3', 'D4', 'G3', 'D4', 'C3', 'G3', 'C4', '0'],
      arp:  ['G4', 'C5', 'E5', 'G5', 'A4', 'C5', 'F5', 'A5', 'B4', 'D5', 'G5', 'B5', 'C5', 'E5', 'G5', 'C6', 'C5', 'E5', 'A5', 'C6', 'A4', 'C5', 'F5', 'A5', 'B4', 'D5', 'G5', 'B5', 'C5', 'E5', 'G5', 'C6']
    }
  ];

  class RetroBGMPlayer {
    constructor() {
      this.currentTrackIdx = 0;
      this.isPlaying = false;
      this.step = 0;
      this.timerId = null;
      this.volume = parseFloat(localStorage.getItem('ap_bgm_vol') || '0.35');
      this.masterGain = null;
      this.soundcloudActive = false;
    }

    init() {
      initAudio();
      if (audioCtx && !this.masterGain) {
        this.masterGain = audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, audioCtx.currentTime);
        this.masterGain.connect(audioCtx.destination);
      }
    }

    setVolume(val) {
      this.volume = Math.max(0, Math.min(1, val));
      localStorage.setItem('ap_bgm_vol', this.volume);
      if (this.masterGain && audioCtx) {
        this.masterGain.gain.setValueAtTime(this.volume, audioCtx.currentTime);
      }
    }

    playNote(freq, type, duration, vol, detune = 0) {
      if (!freq || freq === 0 || !audioCtx || !this.masterGain) return;
      try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        if (detune) osc.detune.setValueAtTime(detune, audioCtx.currentTime);

        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
      } catch (e) {}
    }

    playNoise(duration, vol) {
      if (!audioCtx || !this.masterGain) return;
      try {
        const bufferSize = audioCtx.sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
        noise.connect(gain);
        gain.connect(this.masterGain);
        noise.start();
      } catch (e) {}
    }

    tick() {
      if (!this.isPlaying || this.soundcloudActive) return;
      const track = CHIPTUNE_TRACKS[this.currentTrackIdx];
      const stepLen = 60 / track.bpm / 4; // 16th note length

      const leadNote = track.lead[this.step % track.lead.length];
      const bassNote = track.bass[this.step % track.bass.length];
      const arpNote  = track.arp[this.step % track.arp.length];

      // 1. Lead Melody
      if (leadNote && NOTE_FREQ[leadNote]) {
        this.playNote(NOTE_FREQ[leadNote], 'square', stepLen * 1.8, 0.18, 5);
      }

      // 2. Bassline
      if (bassNote && NOTE_FREQ[bassNote]) {
        this.playNote(NOTE_FREQ[bassNote], 'sawtooth', stepLen * 1.2, 0.22);
      }

      // 3. Arpeggio
      if (arpNote && NOTE_FREQ[arpNote]) {
        this.playNote(NOTE_FREQ[arpNote], 'triangle', stepLen * 0.8, 0.12, -5);
      }

      // 4. Retro Drums
      if (this.step % 4 === 0) {
        // Kick on downbeats
        this.playNote(110, 'sine', 0.08, 0.25);
      }
      if (this.step % 8 === 4) {
        // Snare noise
        this.playNoise(0.06, 0.12);
      } else if (this.step % 2 === 0) {
        // Hi-hat tick
        this.playNoise(0.02, 0.04);
      }

      this.step++;
    }

    start() {
      this.init();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      this.isPlaying = true;
      this.soundcloudActive = false;
      const track = CHIPTUNE_TRACKS[this.currentTrackIdx];
      const intervalMs = (60 / track.bpm / 4) * 1000;
      clearInterval(this.timerId);
      this.timerId = setInterval(() => this.tick(), intervalMs);
      updateMusicUI(true, track.name);
    }

    stop() {
      this.isPlaying = false;
      clearInterval(this.timerId);
      this.step = 0;
      updateMusicUI(false, CHIPTUNE_TRACKS[this.currentTrackIdx].name);
    }

    toggle() {
      if (this.isPlaying) this.stop();
      else this.start();
    }

    nextTrack() {
      this.currentTrackIdx = (this.currentTrackIdx + 1) % CHIPTUNE_TRACKS.length;
      if (this.isPlaying) {
        this.stop();
        this.start();
      } else {
        updateMusicUI(false, CHIPTUNE_TRACKS[this.currentTrackIdx].name);
      }
    }

    setTrack(idx) {
      if (idx >= 0 && idx < CHIPTUNE_TRACKS.length) {
        this.currentTrackIdx = idx;
        if (this.isPlaying) {
          this.stop();
          this.start();
        } else {
          updateMusicUI(false, CHIPTUNE_TRACKS[this.currentTrackIdx].name);
        }
      }
    }
  }

  const bgmPlayer = new RetroBGMPlayer();

  // ==========================================================
  // 2. INDEXEDDB STORAGE (Max 50 Reports, Local-First)
  // ==========================================================
  const DB_NAME = 'APReportGeneratorDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'reports';

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveReportToDB(report) {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      // Auto-prune beyond 50 reports
      const allReq = store.index('timestamp').getAll();
      allReq.onsuccess = () => {
        const all = allReq.result || [];
        if (all.length >= 50) {
          all.sort((a, b) => a.timestamp - b.timestamp);
          const excessCount = (all.length - 50) + 1;
          for (let i = 0; i < excessCount; i++) {
            store.delete(all[i].key);
          }
        }
        store.put(report);
      };

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error('IndexedDB save failed', err);
      return false;
    }
  }

  async function getStoredReports() {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      return new Promise((resolve, reject) => {
        req.onsuccess = () => {
          const list = req.result || [];
          list.sort((a, b) => b.timestamp - a.timestamp); // latest first
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.error('IndexedDB retrieve failed', err);
      return [];
    }
  }

  async function deleteReportFromDB(key) {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error('IndexedDB delete failed', err);
      return false;
    }
  }

  async function clearAllReportsFromDB() {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error('IndexedDB clear failed', err);
      return false;
    }
  }

  // ==========================================================
  // 3. AP LOG PARSER & TELEMETRY HEURISTICS
  // ==========================================================

  function cleanHeader(h) {
    return (h || '')
      .toLowerCase()
      .replace(/\s*\([^)]*\)\s*$/, '') // Remove (units)
      .replace(/[\u00b0\s]+$/, '')      // Remove trailing degree
      .replace(/[^a-z0-9]/g, '')        // Alpha-numeric only
      .trim();
  }

  const HEADER_ALIASES = {
    time: ['time', 'timesec', 'times', 'timeelapsed'],
    boost: ['boost', 'boostpsi', 'boostcalc', 'manifoldpressure', 'manifoldpressurepsi', 'mappsi', 'boostpressure'],
    afr: ['afr', 'afrwideband', 'afsens1ratio', 'afsens1ratioafr', 'widebandafr', 'airfuelratio', 'afratio', 'lambda'],
    timing: ['ignitiontiming', 'timing', 'sparkadvance', 'timingadvance', 'ignadvance'],
    feedback_knock: ['feedbackknock', 'feedbackknockdeg', 'feedbackknockcorrection', 'fbk', 'timingcorrection', 'knockcorrection', 'knockcorr'],
    fine_knock_learn: ['fineknocklearn', 'fineknocklearning', 'fineknocklearndeg', 'fkl'],
    knock_sum: ['knocksum', 'knockcount', 'knocksensor', 'roughnesscyl1'],
    dam: ['dynadvmultdam', 'dam', 'dynamicadvance multiplier', 'dynamicadvmult', 'desiredairmass'],
    rpm: ['rpm', 'rpmrpm', 'enginespeed', 'enginerpm'],
    calc_load: ['calculatedload', 'engineload', 'loadgrev', 'load'],
    fuel_press: ['snsfuelpressmonitor', 'fuelpressure', 'snsfuelpressmonitorpsi', 'fuelpress', 'highpressurefuelpump'],
    oil_temp: ['oiltemp', 'oiltempf', 'engineoiltemp', 'engineoiltemperature'],
    coolant_temp: ['coolanttemp', 'coolanttempf', 'ect', 'enginecoolanttemp', 'coolanttemperature'],
    intake_temp: ['intaketemp', 'intaketempf', 'iat', 'intakeairtemp', 'intakeairtemperature', 'intaketempmanifold'],
    ethanol: ['ethanolconcfinal', 'ethanolconcraw', 'ethanolcontent', 'ethanol', 'ethanolconc'],
    inj_duty_cycle: ['injdutycycle', 'injectordutycycle', 'idc', 'injdutycyclepercent'],
    af_learning_1: ['aflearning1', 'aflearn1', 'longtermfueltrim', 'ltft'],
    af_correction_1: ['afcorrection1', 'afcorr1', 'shorttermfueltrim', 'stft'],
    throttle_pos: ['throttlepos', 'throttleposition', 'throttlepospercent', 'tps', 'accelposition', 'accelpos']
  };

  function matchHeaderKey(rawHeader) {
    const norm = cleanHeader(rawHeader);
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      for (const alias of aliases) {
        if (norm === cleanHeader(alias)) return key;
      }
    }
    return null;
  }

  function parseCSVContent(csvText, filename = 'AP_Log.csv') {
    const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      throw new Error('Log file does not contain enough data rows.');
    }

    const headerLine = lines[0];
    const delimiter = headerLine.includes('\t') ? '\t' : (headerLine.includes(';') ? ';' : ',');
    const rawHeaders = headerLine.split(delimiter).map(h => h.trim());

    // Extract AP Info metadata if present
    let apInfo = '';
    const lastHeader = rawHeaders[rawHeaders.length - 1];
    if (lastHeader && lastHeader.includes('AP Info:')) {
      const match = lastHeader.match(/AP Info:\[(.*)\]/);
      apInfo = match ? match[1].trim() : lastHeader.replace(/^AP Info:/, '').trim();
    }
    const tuneName = apInfo ? apInfo.split('|').pop().trim() : '';

    // Map columns
    const columnMap = {};
    rawHeaders.forEach((h, idx) => {
      const matched = matchHeaderKey(h);
      if (matched && !(matched in columnMap)) {
        columnMap[matched] = idx;
      }
    });

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const fields = lines[i].split(delimiter);
      if (fields.length < rawHeaders.length * 0.7) continue;

      const row = { _idx: i - 1 };
      for (const [key, colIdx] of Object.entries(columnMap)) {
        const val = parseFloat(fields[colIdx]);
        row[key] = isNaN(val) ? 0 : val;
      }
      rows.push(row);
    }

    if (rows.length === 0) {
      throw new Error('Could not parse valid numeric telemetry rows.');
    }

    return { filename, apInfo, tuneName, rows, totalRows: rows.length };
  }

  // ==========================================================
  // 4. REPORT EVALUATION ENGINE & VERDICT RULES
  // ==========================================================

  function generateHealthReport(parsed) {
    const { filename, apInfo, tuneName, rows, totalRows } = parsed;

    const startTime = rows[0].time !== undefined ? rows[0].time : 0;
    const endTime = rows[rows.length - 1].time !== undefined ? rows[rows.length - 1].time : (totalRows * 0.05);
    const durationSec = Math.max(0, endTime - startTime);

    let peakBoostPsi = -Infinity;
    let minAfrInBoost = Infinity;
    let minAfrOverall = Infinity;
    let maxTimingRetardDeg = 0; // Most negative (e.g. -2.81)
    let knockEventsCount = 0;
    let damEventsCount = 0;
    let minDam = 1.0;
    let peakRpm = 0;
    let peakLoad = 0;
    let minFuelPressure = Infinity;
    let maxOilTemp = -Infinity;
    let maxCoolantTemp = -Infinity;
    let maxIat = -Infinity;
    let ethanolPct = 0;
    let peakIdc = 0;
    let maxLtft = 0;
    let maxStft = 0;

    const outOfSpecMoments = [];
    const warnings = [];

    // Evaluate rows
    rows.forEach((r, idx) => {
      const timeSec = r.time !== undefined ? r.time : (idx * 0.05);
      const timeStr = `${timeSec.toFixed(2)}s`;

      // Boost
      if (r.boost !== undefined) {
        if (r.boost > peakBoostPsi) peakBoostPsi = r.boost;
      }

      // AFR
      if (r.afr !== undefined && r.afr > 5 && r.afr < 25) {
        if (r.afr < minAfrOverall) minAfrOverall = r.afr;
        if (r.boost !== undefined && r.boost > 2.0) {
          if (r.afr < minAfrInBoost) minAfrInBoost = r.afr;
          // Check lean condition under boost
          if (r.afr > 12.5) {
            outOfSpecMoments.push({
              time: timeStr,
              param: 'AFR (Wideband)',
              value: `${r.afr.toFixed(2)}:1`,
              safeRange: '11.00 – 12.20 under boost',
              severity: 'hazard',
              note: `Lean mixture at ${r.boost ? r.boost.toFixed(1) : 0} PSI boost`
            });
          }
        }
      }

      // Timing Retard / Feedback Knock
      let retard = 0;
      if (r.feedback_knock !== undefined && r.feedback_knock < 0) {
        retard = Math.min(retard, r.feedback_knock);
      }
      if (r.fine_knock_learn !== undefined && r.fine_knock_learn < 0) {
        retard = Math.min(retard, r.fine_knock_learn);
      }
      if (retard < maxTimingRetardDeg) {
        maxTimingRetardDeg = retard;
      }

      if (retard <= -1.4) {
        knockEventsCount++;
        outOfSpecMoments.push({
          time: timeStr,
          param: 'Timing Correction',
          value: `${retard.toFixed(2)}°`,
          safeRange: '>= -1.00°',
          severity: retard <= -2.8 ? 'hazard' : 'warn',
          note: `Knock correction event at ${Math.round(r.rpm || 0)} RPM`
        });
      } else if (r.knock_sum !== undefined && r.knock_sum > 0) {
        knockEventsCount++;
      }

      // DAM (Dynamic Advance Multiplier)
      if (r.dam !== undefined) {
        if (r.dam < minDam) minDam = r.dam;
        if (r.dam < 0.95 || (r.dam < 1.0 && r.dam > 0.05)) {
          damEventsCount++;
          if (damEventsCount === 1 || damEventsCount % 20 === 0) {
            outOfSpecMoments.push({
              time: timeStr,
              param: 'Dyn Adv Mult (DAM)',
              value: r.dam.toFixed(3),
              safeRange: '1.000',
              severity: r.dam < 0.85 ? 'hazard' : 'warn',
              note: `DAM dropped below 1.000 (Timing pulled globally)`
            });
          }
        }
      }

      // RPM & Load
      if (r.rpm !== undefined && r.rpm > peakRpm) peakRpm = r.rpm;
      if (r.calc_load !== undefined && r.calc_load > peakLoad) peakLoad = r.calc_load;

      // Fuel Pressure
      if (r.fuel_press !== undefined && r.fuel_press > 100) {
        if (r.fuel_press < minFuelPressure) minFuelPressure = r.fuel_press;
        if (r.fuel_press < 1800 && r.boost > 5.0) {
          outOfSpecMoments.push({
            time: timeStr,
            param: 'Fuel Rail Pressure',
            value: `${Math.round(r.fuel_press)} PSI`,
            safeRange: '> 2,000 PSI under load',
            severity: 'hazard',
            note: `Direct injection fuel pressure dip under boost`
          });
        }
      }

      // Temps & Extended Channels
      if (r.oil_temp !== undefined && r.oil_temp > maxOilTemp) maxOilTemp = r.oil_temp;
      if (r.coolant_temp !== undefined && r.coolant_temp > maxCoolantTemp) maxCoolantTemp = r.coolant_temp;
      if (r.intake_temp !== undefined && r.intake_temp > maxIat) maxIat = r.intake_temp;
      if (r.ethanol !== undefined && r.ethanol > 0) ethanolPct = Math.max(ethanolPct, r.ethanol);
      if (r.inj_duty_cycle !== undefined && r.inj_duty_cycle > peakIdc) peakIdc = r.inj_duty_cycle;
      if (r.af_learning_1 !== undefined && !isNaN(r.af_learning_1)) {
        if (Math.abs(r.af_learning_1) > Math.abs(maxLtft)) maxLtft = r.af_learning_1;
      }
      if (r.af_correction_1 !== undefined && !isNaN(r.af_correction_1)) {
        if (Math.abs(r.af_correction_1) > Math.abs(maxStft)) maxStft = r.af_correction_1;
      }
    });

    // Cleanup infinities
    if (peakBoostPsi === -Infinity) peakBoostPsi = 0;
    if (minAfrInBoost === Infinity) minAfrInBoost = (minAfrOverall !== Infinity ? minAfrOverall : 14.7);
    if (minAfrOverall === Infinity) minAfrOverall = 14.7;
    if (minFuelPressure === Infinity) minFuelPressure = 2150;
    if (maxOilTemp === -Infinity) maxOilTemp = 210;
    if (maxCoolantTemp === -Infinity) maxCoolantTemp = 190;
    if (maxIat === -Infinity) maxIat = 90;

    // Build Warnings List
    if (minDam < 0.95) {
      warnings.push(`DAM dropped to ${minDam.toFixed(3)} (${damEventsCount} rows affected). Engine is actively pulling global timing due to detected knock.`);
    }
    if (maxTimingRetardDeg <= -2.8) {
      warnings.push(`Severe timing retard detected (${maxTimingRetardDeg.toFixed(2)}° max correction). Check for fuel octane degradation or spark plug wear.`);
    } else if (maxTimingRetardDeg < -1.0) {
      warnings.push(`Moderate timing retard observed (${maxTimingRetardDeg.toFixed(2)}°). Minor knock correction active.`);
    }
    if (minAfrInBoost > 12.2 && peakBoostPsi > 5.0) {
      warnings.push(`Air/Fuel Ratio leaned out to ${minAfrInBoost.toFixed(2)} under boost (> 12.2 AFR target). Potential fueling restriction.`);
    }
    if (maxOilTemp > 240) {
      warnings.push(`High oil temperature reached ${Math.round(maxOilTemp)}°F. Consider cooling laps or an aftermarket oil cooler.`);
    }
    if (peakIdc > 90) {
      warnings.push(`High Injector Duty Cycle reached ${peakIdc.toFixed(1)}% (> 90% threshold). Fueling system near capacity.`);
    }
    if (Math.abs(maxLtft) > 8.0) {
      warnings.push(`Long Term Fuel Trim drift observed (${maxLtft > 0 ? '+' : ''}${maxLtft.toFixed(1)}%). Check for intake air leaks.`);
    }

    // VERDICT CALCULATION (Per specification)
    // "Good tune" = knock count is 0 AND DAM events < 3 AND all metrics in safe range
    // "Watch knock" = knock count > 0 OR DAM events >= 3
    // "Check tune" = any critical metric out of range (AFR < 10.5, timing < -1.5°, DAM < 0.85, AFR > 12.5 in boost)
    let verdict = 'good';
    let verdictLabel = 'Good tune';

    const hasCriticalAFR = (minAfrInBoost > 12.5 && peakBoostPsi > 4.0) || minAfrInBoost < 10.2;
    const hasCriticalTiming = maxTimingRetardDeg <= -1.5;
    const hasCriticalDAM = minDam < 0.85;

    if (hasCriticalAFR || hasCriticalTiming || hasCriticalDAM) {
      verdict = 'check';
      verdictLabel = 'Check tune';
    } else if (knockEventsCount > 0 || damEventsCount >= 3 || maxTimingRetardDeg < -1.0 || minDam < 0.95) {
      verdict = 'watch';
      verdictLabel = 'Watch knock';
    } else {
      verdict = 'good';
      verdictLabel = 'Good tune';
    }

    const now = Date.now();
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date(now);
    const tsKey = `report-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;

    return {
      key: tsKey,
      timestamp: now,
      timestampFormatted: ReportExport.getTimestampString(now),
      filename,
      apInfo,
      tuneName,
      durationSec,
      totalRows,
      verdict,
      verdictLabel,
      metrics: {
        peakBoostPsi,
        minAfr: minAfrInBoost !== Infinity ? minAfrInBoost : minAfrOverall,
        maxTimingRetardDeg,
        knockCount: knockEventsCount,
        damEvents: damEventsCount,
        minDam,
        peakRpm,
        peakLoad,
        minFuelPressure,
        maxOilTemp,
        maxCoolantTemp,
        maxIat,
        ethanolPct,
        peakIdc,
        maxLtft,
        maxStft
      },
      safeRanges: {
        afr: '11.0 – 13.5 (under boost: 11.2–12.0)',
        timing: '>= -1.00°',
        dam: '1.000 (>= 0.95)',
        knock: '0 counts',
        fuelPressure: '> 2000 PSI under load',
        oilTemp: '< 235°F',
        idc: '< 85%'
      },
      warnings,
      outOfSpecMoments
    };
  }

  // ==========================================================
  // 5. SAMPLE DEMO DATASETS (Built-in Clean and Knock Logs)
  // ==========================================================
  const SAMPLE_LOGS = {
    clean: `Time (sec)\tBoost (psi)\tAF Sens 1 Ratio (AFR)\tFeedback Knock (°)\tFine Knock Learn (°)\tDyn Adv Mult (DAM)\tRPM (RPM)\tCalculated Load (g/rev)\tSns Fuel Press MONITOR (psi)\tOil Temp (F)\tThrottle Pos (%)\tAP Info:[COBB AP v1.7.2 | 2022 SUBARU WRX MT | Stage 1 93 Baseline Clean]
0.020\t-11.05\t14.71\t0.00\t0.00\t1.000\t2500\t0.45\t2156\t205\t15.0
0.500\t2.50\t13.20\t0.00\t0.00\t1.000\t2800\t1.20\t2200\t206\t95.0
1.000\t14.80\t11.45\t0.00\t0.00\t1.000\t3400\t2.35\t2250\t206\t100.0
1.500\t17.50\t11.30\t0.00\t0.00\t1.000\t4200\t2.60\t2280\t207\t100.0
2.000\t18.20\t11.25\t0.00\t0.00\t1.000\t5100\t2.55\t2300\t208\t100.0
2.500\t16.80\t11.20\t0.00\t0.00\t1.000\t6000\t2.40\t2290\t209\t100.0
3.000\t-5.00\t14.70\t0.00\t0.00\t1.000\t4500\t0.50\t2180\t210\t0.0`,

    knock: `Time (sec)\tBoost (psi)\tAF Sens 1 Ratio (AFR)\tFeedback Knock (°)\tFine Knock Learn (°)\tDyn Adv Mult (DAM)\tRPM (RPM)\tCalculated Load (g/rev)\tSns Fuel Press MONITOR (psi)\tOil Temp (F)\tThrottle Pos (%)\tAP Info:[COBB AP v1.7.2 | 2022 SUBARU WRX MT | Stage 2 91 Octane Knock Log]
0.020\t-10.50\t14.71\t0.00\t0.00\t1.000\t2400\t0.45\t2156\t210\t15.0
0.500\t5.20\t12.80\t0.00\t0.00\t1.000\t2900\t1.40\t2180\t211\t95.0
1.000\t16.40\t11.80\t-1.41\t0.00\t0.875\t3600\t2.45\t2200\t212\t100.0
1.500\t18.90\t12.65\t-2.81\t-1.41\t0.875\t4500\t2.75\t1720\t214\t100.0
2.000\t17.40\t12.40\t-2.81\t-1.41\t0.875\t5300\t2.60\t1890\t216\t100.0
2.500\t15.80\t11.90\t-1.41\t-1.41\t0.875\t6100\t2.35\t2100\t218\t100.0
3.000\t-8.00\t15.20\t0.00\t0.00\t0.875\t4200\t0.40\t2150\t218\t0.0`
  };

  function updateMusicUI(isPlaying, trackName) {
    if (DOM.headerMusicPill) {
      if (isPlaying) {
        DOM.headerMusicPill.classList.add('playing');
        if (DOM.btnPlayBgm) DOM.btnPlayBgm.textContent = '⏸️';
        if (DOM.btnModalPlayBgm) DOM.btnModalPlayBgm.textContent = '⏸️ PAUSE BGM';
        if (DOM.boomboxDeck) DOM.boomboxDeck.classList.add('playing');
      } else {
        DOM.headerMusicPill.classList.remove('playing');
        if (DOM.btnPlayBgm) DOM.btnPlayBgm.textContent = '▶️';
        if (DOM.btnModalPlayBgm) DOM.btnModalPlayBgm.textContent = '▶️ PLAY 8-BIT BGM';
        if (DOM.boomboxDeck) DOM.boomboxDeck.classList.remove('playing');
      }
    }
    if (DOM.musicTrackName && trackName) {
      DOM.musicTrackName.textContent = trackName;
    }
  }

  // ==========================================================
  // 6. UI RENDERER & DOM CONTROLLER
  // ==========================================================

  let currentReport = null;
  let activeReportsList = [];

  const DOM = {};

  function initDOM() {
    DOM.dropZone = document.getElementById('drop-zone');
    DOM.fileInput = document.getElementById('file-input');
    DOM.btnFilePick = document.getElementById('btn-file-pick');
    DOM.btnScan = document.getElementById('btn-scan');
    DOM.btnDemoClean = document.getElementById('btn-demo-clean');
    DOM.btnDemoKnock = document.getElementById('btn-demo-knock');
    DOM.btnSoundToggle = document.getElementById('btn-sound-toggle');
    DOM.btnRetroToggle = document.getElementById('btn-retro-toggle');
    DOM.btnHistory = document.getElementById('btn-history');
    DOM.btnCompare = document.getElementById('btn-compare');
    DOM.btnClearHistory = document.getElementById('btn-clear-history');
    DOM.btnResetView = document.getElementById('btn-reset-view');

    // Music & Boombox elements
    DOM.headerMusicPill = document.getElementById('header-music-pill');
    DOM.btnPlayBgm = document.getElementById('btn-play-bgm');
    DOM.btnOpenRadio = document.getElementById('btn-open-radio');
    DOM.musicTrackName = document.getElementById('music-track-name');
    DOM.boomboxModal = document.getElementById('boombox-modal');
    DOM.btnCloseBoombox = document.getElementById('btn-close-boombox');
    DOM.boomboxDeck = document.getElementById('boombox-deck');
    DOM.btnModalPlayBgm = document.getElementById('btn-modal-play-bgm');
    DOM.btnModalNextTrack = document.getElementById('btn-modal-next-track');
    DOM.bgmVolumeSlider = document.getElementById('bgm-volume-slider');
    DOM.tabChiptune = document.getElementById('tab-chiptune');
    DOM.tabSoundcloud = document.getElementById('tab-soundcloud');
    DOM.chiptunePane = document.getElementById('chiptune-pane');
    DOM.soundcloudPane = document.getElementById('soundcloud-pane');
    DOM.inputSoundcloudUrl = document.getElementById('input-soundcloud-url');
    DOM.btnLoadSoundcloud = document.getElementById('btn-load-soundcloud');
    DOM.soundcloudIframe = document.getElementById('soundcloud-iframe');

    DOM.terminalLogger = document.getElementById('terminal-logger');
    DOM.terminalMsg = document.getElementById('terminal-msg');
    DOM.reportArea = document.getElementById('report-area');

    // Report fields
    DOM.reportFilename = document.getElementById('report-filename');
    DOM.reportMetaDetails = document.getElementById('report-meta-details');
    DOM.verdictMarquee = document.getElementById('verdict-marquee');
    DOM.verdictTag = document.getElementById('verdict-tag');
    DOM.verdictText = document.getElementById('verdict-text');

    // HUD Value Elements
    DOM.hudPeakBoost = document.getElementById('hud-peak-boost');
    DOM.hudMinAfr = document.getElementById('hud-min-afr');
    DOM.hudTimingRetard = document.getElementById('hud-timing-retard');
    DOM.hudKnockCount = document.getElementById('hud-knock-count');
    DOM.hudDamEvents = document.getElementById('hud-dam-events');
    DOM.hudPeakRpm = document.getElementById('hud-peak-rpm');

    // Warnings & Out of spec
    DOM.warningsTicker = document.getElementById('warnings-ticker');
    DOM.outOfSpecTableBody = document.getElementById('out-of-spec-table-body');
    DOM.outOfSpecWrapper = document.getElementById('out-of-spec-wrapper');

    // Export Buttons
    DOM.btnExportPdf = document.getElementById('btn-export-pdf');
    DOM.btnExportJson = document.getElementById('btn-export-json');
    DOM.btnExportCsv = document.getElementById('btn-export-csv');

    // Integrations
    DOM.btnCopyGithub = document.getElementById('btn-copy-github');
    DOM.btnConnectSheets = document.getElementById('btn-connect-sheets');
    DOM.btnCopySheetsRow = document.getElementById('btn-copy-sheets-row');
    DOM.inputSheetsUrl = document.getElementById('input-sheets-url');
    DOM.btnToggleSheetsUrl = document.getElementById('btn-toggle-sheets-url');
    DOM.chkSheetsSync = document.getElementById('chk-sheets-sync');
    DOM.sheetsStatus = document.getElementById('sheets-status');

    // Modals
    DOM.historyModal = document.getElementById('history-modal');
    DOM.btnCloseHistory = document.getElementById('btn-close-history');
    DOM.historyList = document.getElementById('history-list');

    DOM.compareModal = document.getElementById('compare-modal');
    DOM.btnCloseCompare = document.getElementById('btn-close-compare');
    DOM.compareSelectA = document.getElementById('compare-select-a');
    DOM.compareSelectB = document.getElementById('compare-select-b');
    DOM.compareResults = document.getElementById('compare-results');

    DOM.toast = document.getElementById('arcade-toast');
  }

  function showToast(msg) {
    if (!DOM.toast) return;
    DOM.toast.textContent = msg;
    DOM.toast.classList.add('show');
    setTimeout(() => {
      DOM.toast.classList.remove('show');
    }, 3000);
  }

  function logTerminal(msg) {
    if (DOM.terminalMsg) {
      DOM.terminalMsg.textContent = msg;
    }
  }

  function renderReport(report) {
    currentReport = report;
    DOM.reportArea.classList.remove('hidden');

    // Meta
    DOM.reportFilename.textContent = report.filename;
    DOM.reportMetaDetails.innerHTML = `
      <div>Duration: <span>${report.durationSec.toFixed(2)}s</span></div>
      <div>Rows Analyzed: <span>${report.totalRows}</span></div>
      <div>Generated: <span>${new Date(report.timestamp).toLocaleTimeString()}</span></div>
      ${report.tuneName ? `<div>Tune: <span>${report.tuneName}</span></div>` : ''}
    `;

    // Verdict Marquee
    DOM.verdictMarquee.className = `verdict-marquee verdict-${report.verdict}`;
    DOM.verdictTag.textContent = report.verdict === 'good' ? '★ CALIBRATION SAFE ★' : (report.verdict === 'watch' ? '⚠ MONITOR ACTIVE ⚠' : '⚡ CRITICAL ALERT ⚡');
    DOM.verdictText.textContent = report.verdictLabel;

    // HUD values
    DOM.hudPeakBoost.textContent = `${report.metrics.peakBoostPsi.toFixed(1)} PSI`;
    DOM.hudMinAfr.textContent = `${report.metrics.minAfr.toFixed(2)}:1`;
    DOM.hudTimingRetard.textContent = `${report.metrics.maxTimingRetardDeg.toFixed(2)}°`;
    DOM.hudKnockCount.textContent = `${report.metrics.knockCount} EVENTS`;
    DOM.hudDamEvents.textContent = `${report.metrics.minDam.toFixed(3)} (${report.metrics.damEvents} rows)`;
    DOM.hudPeakRpm.textContent = `${Math.round(report.metrics.peakRpm)} RPM`;

    // Card styling flags
    const boostCard = DOM.hudPeakBoost.closest('.hud-card');
    const afrCard = DOM.hudMinAfr.closest('.hud-card');
    const retardCard = DOM.hudTimingRetard.closest('.hud-card');
    const knockCard = DOM.hudKnockCount.closest('.hud-card');
    const damCard = DOM.hudDamEvents.closest('.hud-card');

    if (afrCard) afrCard.className = `hud-card ${report.metrics.minAfr > 12.5 ? 'hazard-card' : 'safe-card'}`;
    if (retardCard) retardCard.className = `hud-card ${report.metrics.maxTimingRetardDeg <= -1.5 ? 'hazard-card' : (report.metrics.maxTimingRetardDeg < 0 ? 'safe-card' : '')}`;
    if (knockCard) knockCard.className = `hud-card ${report.metrics.knockCount > 0 ? 'hazard-card' : 'safe-card'}`;
    if (damCard) damCard.className = `hud-card ${report.metrics.minDam < 0.95 ? 'hazard-card' : 'safe-card'}`;

    // Warnings ticker
    DOM.warningsTicker.innerHTML = '';
    if (report.warnings.length === 0) {
      DOM.warningsTicker.innerHTML = `
        <div class="ticker-item">
          <span class="ticker-badge badge-ok">SAFE</span>
          <span class="ticker-text">All key FA24 telemetry channels are within optimal operating parameters. No knock or lean events detected.</span>
        </div>
      `;
    } else {
      report.warnings.forEach(w => {
        const item = document.createElement('div');
        item.className = 'ticker-item';
        item.innerHTML = `
          <span class="ticker-badge ${w.includes('Severe') || w.includes('dropped') ? 'badge-hazard' : 'badge-warn'}">ALERT</span>
          <span class="ticker-text">${w}</span>
        `;
        DOM.warningsTicker.appendChild(item);
      });
    }

    // Out of Spec Table
    DOM.outOfSpecTableBody.innerHTML = '';
    if (report.outOfSpecMoments.length === 0) {
      DOM.outOfSpecWrapper.classList.add('hidden');
    } else {
      DOM.outOfSpecWrapper.classList.remove('hidden');
      report.outOfSpecMoments.slice(0, 15).forEach(m => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td style="color:var(--neon-cyan);">${m.time}</td>
          <td><strong>${m.param}</strong></td>
          <td style="color:${m.severity === 'hazard' ? 'var(--neon-red)' : 'var(--neon-yellow)'}; font-weight:bold;">${m.value}</td>
          <td>${m.safeRange}</td>
          <td>${m.note}</td>
        `;
        DOM.outOfSpecTableBody.appendChild(row);
      });
    }

    // Play appropriate sound
    if (report.verdict === 'good') SoundFX.good();
    else if (report.verdict === 'watch') SoundFX.warn();
    else SoundFX.hazard();

    // Scroll smoothly to report
    DOM.reportArea.scrollIntoView({ behavior: 'smooth' });

    // Cloud sync check if enabled
    ReportExport.syncReportToSheets(report).then(res => {
      if (res.success) {
        showToast('☁️ Auto-synced to Google Sheet!');
      }
    });
  }

  async function processLogText(text, filename) {
    try {
      SoundFX.scan();
      logTerminal(`SCANNING LOG: ${filename}...`);
      
      const parsed = parseCSVContent(text, filename);
      logTerminal(`PARSED ${parsed.totalRows} ROWS. EVALUATING SAFETY RULES...`);

      const report = generateHealthReport(parsed);
      await saveReportToDB(report);
      
      logTerminal(`ANALYSIS COMPLETE. VERDICT: ${report.verdictLabel.toUpperCase()}`);
      renderReport(report);
      showToast('💾 Report saved to local history!');
    } catch (err) {
      console.error('Log process error:', err);
      logTerminal(`ERROR: ${err.message}`);
      SoundFX.warn();
      alert(`Could not process log file: ${err.message}`);
    }
  }

  // ==========================================================
  // 7. FILING CABINET (HISTORY MODAL) & COMPARISON
  // ==========================================================

  async function openHistoryCabinet() {
    SoundFX.click();
    activeReportsList = await getStoredReports();
    DOM.historyList.innerHTML = '';

    if (activeReportsList.length === 0) {
      DOM.historyList.innerHTML = `
        <div style="text-align:center; padding:30px; font-family:var(--font-mono); color:var(--text-dim);">
          <div style="font-size:2rem; margin-bottom:10px;">📭</div>
          No saved reports found in IndexedDB storage.
        </div>
      `;
    } else {
      activeReportsList.forEach(rep => {
        const card = document.createElement('div');
        card.className = 'cabinet-card';
        const dateStr = new Date(rep.timestamp).toLocaleString();
        card.innerHTML = `
          <div class="cabinet-card-meta">
            <div class="cabinet-filename">${rep.filename}</div>
            <div class="cabinet-sub">📅 ${dateStr} · ⏱️ ${rep.durationSec.toFixed(1)}s · 📈 Peak: ${rep.metrics.peakBoostPsi.toFixed(1)} PSI</div>
          </div>
          <div class="cabinet-card-actions">
            <span class="ticker-badge ${rep.verdict === 'good' ? 'badge-ok' : (rep.verdict === 'watch' ? 'badge-warn' : 'badge-hazard')}">${rep.verdictLabel}</span>
            <button class="btn-arcade btn-sm btn-view-hist" data-key="${rep.key}">VIEW</button>
            <button class="btn-arcade btn-red btn-sm btn-del-hist" data-key="${rep.key}" title="Erase Record">ERASE</button>
          </div>
        `;

        // View single report
        card.querySelector('.btn-view-hist').addEventListener('click', (e) => {
          e.stopPropagation();
          SoundFX.click();
          renderReport(rep);
          DOM.historyModal.classList.remove('active');
        });

        // Delete single report
        card.querySelector('.btn-del-hist').addEventListener('click', async (e) => {
          e.stopPropagation();
          SoundFX.delete();
          if (confirm(`Erase stored report for "${rep.filename}"?`)) {
            await deleteReportFromDB(rep.key);
            showToast('🗑️ Report erased');
            openHistoryCabinet();
          }
        });

        DOM.historyList.appendChild(card);
      });
    }

    DOM.historyModal.classList.add('active');
  }

  async function openCompareModal() {
    SoundFX.click();
    activeReportsList = await getStoredReports();
    if (activeReportsList.length < 2) {
      alert('Please analyze or generate at least 2 reports to use the comparison tool.');
      return;
    }

    DOM.compareSelectA.innerHTML = '';
    DOM.compareSelectB.innerHTML = '';

    activeReportsList.forEach((rep, idx) => {
      const optA = document.createElement('option');
      optA.value = rep.key;
      optA.textContent = `${rep.filename} (${new Date(rep.timestamp).toLocaleDateString()}) - ${rep.verdictLabel}`;
      if (idx === 0) optA.selected = true;
      DOM.compareSelectA.appendChild(optA);

      const optB = document.createElement('option');
      optB.value = rep.key;
      optB.textContent = `${rep.filename} (${new Date(rep.timestamp).toLocaleDateString()}) - ${rep.verdictLabel}`;
      if (idx === 1) optB.selected = true;
      DOM.compareSelectB.appendChild(optB);
    });

    renderComparison();
    DOM.compareModal.classList.add('active');
  }

  function renderComparison() {
    const keyA = DOM.compareSelectA.value;
    const keyB = DOM.compareSelectB.value;
    const repA = activeReportsList.find(r => r.key === keyA);
    const repB = activeReportsList.find(r => r.key === keyB);

    if (!repA || !repB) return;

    const deltaBoost = repB.metrics.peakBoostPsi - repA.metrics.peakBoostPsi;
    const deltaAfr = repB.metrics.minAfr - repA.metrics.minAfr;
    const deltaKnock = repB.metrics.knockCount - repA.metrics.knockCount;
    const deltaTiming = repB.metrics.maxTimingRetardDeg - repA.metrics.maxTimingRetardDeg;

    DOM.compareResults.innerHTML = `
      <div class="compare-grid">
        <div class="compare-column">
          <div class="compare-col-header">LOG A: ${repA.filename}</div>
          <div class="compare-stat-row"><span>Verdict</span><strong class="${repA.verdict === 'good' ? 'compare-delta-pos' : 'compare-delta-neg'}">${repA.verdictLabel}</strong></div>
          <div class="compare-stat-row"><span>Peak Boost</span><strong>${repA.metrics.peakBoostPsi.toFixed(1)} PSI</strong></div>
          <div class="compare-stat-row"><span>Min AFR</span><strong>${repA.metrics.minAfr.toFixed(2)}</strong></div>
          <div class="compare-stat-row"><span>Max Timing Retard</span><strong>${repA.metrics.maxTimingRetardDeg.toFixed(2)}°</strong></div>
          <div class="compare-stat-row"><span>Knock Events</span><strong>${repA.metrics.knockCount}</strong></div>
          <div class="compare-stat-row"><span>Min DAM</span><strong>${repA.metrics.minDam.toFixed(3)}</strong></div>
        </div>

        <div class="compare-column">
          <div class="compare-col-header">LOG B: ${repB.filename}</div>
          <div class="compare-stat-row"><span>Verdict</span><strong class="${repB.verdict === 'good' ? 'compare-delta-pos' : 'compare-delta-neg'}">${repB.verdictLabel}</strong></div>
          <div class="compare-stat-row"><span>Peak Boost</span><strong>${repB.metrics.peakBoostPsi.toFixed(1)} PSI <span class="${deltaBoost >= 0 ? 'compare-delta-pos' : 'compare-delta-neg'}">(${deltaBoost >= 0 ? '+' : ''}${deltaBoost.toFixed(1)})</span></strong></div>
          <div class="compare-stat-row"><span>Min AFR</span><strong>${repB.metrics.minAfr.toFixed(2)} <span class="${deltaAfr <= 0 ? 'compare-delta-pos' : 'compare-delta-neg'}">(${deltaAfr >= 0 ? '+' : ''}${deltaAfr.toFixed(2)})</span></strong></div>
          <div class="compare-stat-row"><span>Max Timing Retard</span><strong>${repB.metrics.maxTimingRetardDeg.toFixed(2)}° <span class="${deltaTiming >= 0 ? 'compare-delta-pos' : 'compare-delta-neg'}">(${deltaTiming >= 0 ? '+' : ''}${deltaTiming.toFixed(2)})</span></strong></div>
          <div class="compare-stat-row"><span>Knock Events</span><strong>${repB.metrics.knockCount} <span class="${deltaKnock <= 0 ? 'compare-delta-pos' : 'compare-delta-neg'}">(${deltaKnock >= 0 ? '+' : ''}${deltaKnock})</span></strong></div>
          <div class="compare-stat-row"><span>Min DAM</span><strong>${repB.metrics.minDam.toFixed(3)}</strong></div>
        </div>
      </div>
    `;
  }

  // ==========================================================
  // 8. EVENT LISTENERS SETUP
  // ==========================================================

  function bindEvents() {
    // Sound & Retro Mode toggles
    soundEnabled = localStorage.getItem('ap_report_sound') !== 'false';
    DOM.btnSoundToggle.textContent = soundEnabled ? '🔊 SFX ON' : '🔇 SFX OFF';
    DOM.btnSoundToggle.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      localStorage.setItem('ap_report_sound', soundEnabled);
      DOM.btnSoundToggle.textContent = soundEnabled ? '🔊 SFX ON' : '🔇 SFX OFF';
      SoundFX.click();
    });

    // BGM Music & Boombox Controls
    if (DOM.btnPlayBgm) {
      DOM.btnPlayBgm.addEventListener('click', (e) => {
        e.stopPropagation();
        bgmPlayer.toggle();
      });
    }

    if (DOM.btnModalPlayBgm) {
      DOM.btnModalPlayBgm.addEventListener('click', () => {
        SoundFX.click();
        bgmPlayer.toggle();
      });
    }

    if (DOM.btnModalNextTrack) {
      DOM.btnModalNextTrack.addEventListener('click', () => {
        SoundFX.click();
        bgmPlayer.nextTrack();
        highlightActiveTrack();
      });
    }

    if (DOM.bgmVolumeSlider) {
      DOM.bgmVolumeSlider.value = bgmPlayer.volume * 100;
      DOM.bgmVolumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) / 100;
        bgmPlayer.setVolume(val);
      });
    }

    if (DOM.btnOpenRadio) {
      DOM.btnOpenRadio.addEventListener('click', () => {
        SoundFX.click();
        DOM.boomboxModal.classList.add('active');
        highlightActiveTrack();
      });
    }

    if (DOM.btnCloseBoombox) {
      DOM.btnCloseBoombox.addEventListener('click', () => {
        SoundFX.click();
        DOM.boomboxModal.classList.remove('active');
      });
    }

    function highlightActiveTrack() {
      document.querySelectorAll('.chiptune-track-card').forEach((card, idx) => {
        if (idx === bgmPlayer.currentTrackIdx) {
          card.classList.add('active-track');
        } else {
          card.classList.remove('active-track');
        }
      });
    }

    document.querySelectorAll('.chiptune-track-card').forEach((card) => {
      card.addEventListener('click', () => {
        const trackIdx = parseInt(card.getAttribute('data-track-idx'), 10);
        bgmPlayer.setTrack(trackIdx);
        bgmPlayer.start();
        highlightActiveTrack();
      });
    });

    // Tab switching for Chiptune vs SoundCloud
    if (DOM.tabChiptune && DOM.tabSoundcloud) {
      DOM.tabChiptune.addEventListener('click', () => {
        SoundFX.click();
        DOM.tabChiptune.classList.add('active');
        DOM.tabSoundcloud.classList.remove('active');
        DOM.chiptunePane.classList.remove('hidden');
        DOM.soundcloudPane.classList.add('hidden');
      });

      DOM.tabSoundcloud.addEventListener('click', () => {
        SoundFX.click();
        DOM.tabSoundcloud.classList.add('active');
        DOM.tabChiptune.classList.remove('active');
        DOM.soundcloudPane.classList.remove('hidden');
        DOM.chiptunePane.classList.add('hidden');
      });
    }

    // SoundCloud preset buttons and custom URL loader
    document.querySelectorAll('.btn-sc-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        SoundFX.click();
        const url = btn.getAttribute('data-sc-url');
        loadSoundcloudUrl(url);
      });
    });

    if (DOM.btnLoadSoundcloud) {
      DOM.btnLoadSoundcloud.addEventListener('click', () => {
        SoundFX.click();
        const url = DOM.inputSoundcloudUrl.value.trim();
        if (url) {
          loadSoundcloudUrl(url);
        }
      });
    }

    function loadSoundcloudUrl(trackOrPlaylistUrl) {
      bgmPlayer.stop(); // Stop 8-bit synth when soundcloud is active
      bgmPlayer.soundcloudActive = true;
      const encoded = encodeURIComponent(trackOrPlaylistUrl);
      const embedUrl = `https://w.soundcloud.com/player/?url=${encoded}&color=%23ff007f&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`;
      if (DOM.soundcloudIframe) {
        DOM.soundcloudIframe.src = embedUrl;
      }
      updateMusicUI(true, '☁️ SoundCloud Stream');
      showToast('📻 Loading SoundCloud track...');
    }

    const isRetro = localStorage.getItem('ap_report_retro') !== 'false';
    if (isRetro) document.body.classList.add('retro-mode');
    else document.body.classList.remove('retro-mode');
    DOM.btnRetroToggle.textContent = isRetro ? '📺 RETRO CRT' : '💻 CLEAN MODE';
    DOM.btnRetroToggle.addEventListener('click', () => {
      SoundFX.click();
      const active = document.body.classList.toggle('retro-mode');
      localStorage.setItem('ap_report_retro', active);
      DOM.btnRetroToggle.textContent = active ? '📺 RETRO CRT' : '💻 CLEAN MODE';
    });

    // File picker button
    DOM.btnFilePick.addEventListener('click', () => {
      SoundFX.click();
      DOM.fileInput.click();
    });

    DOM.fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => processLogText(evt.target.result, file.name);
        reader.readAsText(file);
      }
    });

    // Drag & Drop
    ['dragenter', 'dragover'].forEach(name => {
      DOM.dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        DOM.dropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      DOM.dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        DOM.dropZone.classList.remove('dragover');
      });
    });

    DOM.dropZone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => processLogText(evt.target.result, file.name);
        reader.readAsText(file);
      }
    });

    // Scan Button
    DOM.btnScan.addEventListener('click', () => {
      SoundFX.click();
      if (!DOM.fileInput.files || DOM.fileInput.files.length === 0) {
        DOM.fileInput.click();
      } else {
        const file = DOM.fileInput.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => processLogText(evt.target.result, file.name);
        reader.readAsText(file);
      }
    });

    // Demo Log buttons
    DOM.btnDemoClean.addEventListener('click', () => {
      processLogText(SAMPLE_LOGS.clean, 'Demo_Clean_Tune_FA24.csv');
    });

    DOM.btnDemoKnock.addEventListener('click', () => {
      processLogText(SAMPLE_LOGS.knock, 'Demo_Knock_Retard_FA24.csv');
    });

    // Reset View / Analyze another
    DOM.btnResetView.addEventListener('click', () => {
      SoundFX.click();
      DOM.reportArea.classList.add('hidden');
      DOM.dropZone.scrollIntoView({ behavior: 'smooth' });
      logTerminal('READY. DROP AP CSV LOG TO SCAN.');
    });

    // Export Buttons
    DOM.btnExportPdf.addEventListener('click', () => {
      SoundFX.click();
      if (currentReport) ReportExport.exportPDF(currentReport);
    });

    DOM.btnExportJson.addEventListener('click', () => {
      SoundFX.click();
      if (currentReport) {
        ReportExport.exportJSON(currentReport);
        showToast('💾 JSON Report Downloaded');
      }
    });

    DOM.btnExportCsv.addEventListener('click', () => {
      SoundFX.click();
      if (currentReport) {
        ReportExport.exportCSV(currentReport);
        showToast('📊 CSV Report Downloaded');
      }
    });

    // GitHub Copy
    DOM.btnCopyGithub.addEventListener('click', async () => {
      SoundFX.click();
      const ok = await ReportExport.copyGitHubInstructions(currentReport);
      if (ok) showToast('📋 GitHub instructions copied to clipboard!');
    });

    // Google Sheets
    const sheetsCfg = ReportExport.getSheetsConfig();
    DOM.inputSheetsUrl.value = sheetsCfg.url;
    DOM.chkSheetsSync.checked = sheetsCfg.enabled;
    updateSheetsStatus(sheetsCfg.enabled && sheetsCfg.url);

    if (DOM.btnToggleSheetsUrl) {
      DOM.btnToggleSheetsUrl.addEventListener('click', () => {
        SoundFX.click();
        const currentType = DOM.inputSheetsUrl.getAttribute('type');
        const newType = currentType === 'password' ? 'text' : 'password';
        DOM.inputSheetsUrl.setAttribute('type', newType);
        DOM.btnToggleSheetsUrl.textContent = newType === 'password' ? '👁️' : '🔒';
      });
    }

    DOM.btnConnectSheets.addEventListener('click', () => {
      SoundFX.click();
      const url = DOM.inputSheetsUrl.value.trim();
      const enabled = DOM.chkSheetsSync.checked;
      ReportExport.saveSheetsConfig(url, enabled);
      updateSheetsStatus(enabled && url);
      showToast('☁️ Sheets settings saved!');
    });

    DOM.btnCopySheetsRow.addEventListener('click', () => {
      SoundFX.click();
      if (currentReport) {
        const ok = ReportExport.copySheetsRow(currentReport);
        if (ok) showToast('📋 Copied spreadsheet row to clipboard!');
      }
    });

    function updateSheetsStatus(isConnected) {
      if (isConnected) {
        DOM.sheetsStatus.textContent = 'CONNECTED';
        DOM.sheetsStatus.className = 'integration-status status-connected';
      } else {
        DOM.sheetsStatus.textContent = 'DISCONNECTED';
        DOM.sheetsStatus.className = 'integration-status status-disconnected';
      }
    }

    // History Cabinet
    DOM.btnHistory.addEventListener('click', openHistoryCabinet);
    DOM.btnCloseHistory.addEventListener('click', () => {
      SoundFX.click();
      DOM.historyModal.classList.remove('active');
    });

    DOM.btnClearHistory.addEventListener('click', async () => {
      SoundFX.delete();
      if (confirm('⚠️ Erase ALL stored datalog reports from browser IndexedDB?')) {
        await clearAllReportsFromDB();
        showToast('🗑️ All history erased');
        DOM.historyModal.classList.remove('active');
      }
    });

    // Compare
    DOM.btnCompare.addEventListener('click', openCompareModal);
    DOM.btnCloseCompare.addEventListener('click', () => {
      SoundFX.click();
      DOM.compareModal.classList.remove('active');
    });
    DOM.compareSelectA.addEventListener('change', renderComparison);
    DOM.compareSelectB.addEventListener('change', renderComparison);
  }

  // ==========================================================
  // INITIALIZATION ON DOM CONTENT LOADED
  // ==========================================================
  document.addEventListener('DOMContentLoaded', () => {
    initDOM();
    bindEvents();
    logTerminal('SYSTEM READY. DROP COBB AP CSV LOG TO COMMENCE HEALTH SCAN.');
  });

})();

