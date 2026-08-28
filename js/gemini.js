'use strict';

/**
 * Google Gemini AI Integration for AP Log Analyzer
 * Directly connects browser client to Google Gemini models.
 */
window.GeminiService = (function () {
  const STORAGE_KEY = 'ap_gemini_api_key';
  const MODEL_KEY = 'ap_gemini_model';
  const DEFAULT_MODEL = 'gemini-3.6-flash';
  const DEPRECATED_MODEL_ALIASES = {
    'gemini-2.0-flash': DEFAULT_MODEL
  };

  function normalizeModel(model) {
    const cleaned = (model || '').trim();
    if (!cleaned) return DEFAULT_MODEL;
    return DEPRECATED_MODEL_ALIASES[cleaned] || cleaned;
  }

  function getApiKey() {
    return localStorage.getItem(STORAGE_KEY) || '';
  }

  function setApiKey(key) {
    if (!key) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, key.trim());
    }
  }

  function hasApiKey() {
    const key = getApiKey();
    return Boolean(key && key.length > 5);
  }

  function getModel() {
    const stored = localStorage.getItem(MODEL_KEY);
    const normalized = normalizeModel(stored);

    // Migrate deprecated stored model names in-place.
    if (stored !== normalized) {
      localStorage.setItem(MODEL_KEY, normalized);
    }

    return normalized;
  }

  function setModel(model) {
    localStorage.setItem(MODEL_KEY, normalizeModel(model));
  }

  async function testApiKey(key) {
    if (!key) throw new Error('API key is empty.');
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const errJson = await resp.json().catch(() => ({}));
      const msg = errJson.error?.message || `HTTP ${resp.status}: ${resp.statusText}`;
      throw new Error(msg);
    }
    return true;
  }

  function buildSystemPrompt() {
    return `You are a World-Class Master Engine Calibrator and Motorsports Data Analyst specializing in Subaru WRX (FA24 / FA20 / EJ engines) and Cobb AccessPort datalogs.
Your job is to analyze telemetry logs with surgical precision.

Key Subaru FA24 Rules of Thumb:
1. Dynamic Advance Multiplier (DAM): Normal is 1.000. Drops (<1.0) indicate persistent knock requiring immediate attention or octane increase.
2. Feedback Knock (FBK): ECU's instant reactive correction. Values 0 to -1.41° are common during throttle blips/cruising (often noise/AC). Values ≤ -2.8° during WOT are hazardous.
3. Fine Knock Learn (FKL): Learned correction in specific RPM/Load cells. Negative values during WOT indicate engine has repeatedly knocked in that cell.
4. Air/Fuel Ratio (AFR): Under WOT boost (>10 psi), target is 11.2 - 11.8 on pump gas / E-blends. Anything >12.2 AFR under positive pressure is dangerously lean.
5. Injector Duty Cycle (IDC): Must remain under 85-90%.
6. Direct Injection Fuel Pressure: Should hold steady at >2,000 psi under WOT. Drops <1,800 psi indicate fuel feed limitations.
7. Boost Control: Boost target vs actual should track cleanly without sustained overshoot (>2 psi) or oscillation.

Format your responses with clear markdown, bullet points, and actionable mechanical / tuning recommendations.`;
  }

  function formatSessionTelemetry(session) {
    const stats = session.stats || {};
    const pulls = session.pulls || [];
    const findings = session.findings || [];

    const pullSummaries = pulls.map((p, i) => 
      `Pull #${i + 1}: ${p.startRpm?.toFixed(0) || 0} -> ${p.peakRpm?.toFixed(0) || 0} RPM, Peak Boost: ${p.peakBoost?.toFixed(1) || 0} psi, Duration: ${p.durationSec?.toFixed(2) || 0}s`
    ).join('\n');

    const issues = findings.filter(f => f.severity === 'ugly' || f.severity === 'bad')
      .map(f => `[${f.severity.toUpperCase()}] ${f.label}: ${f.message} (Time: ${f.timestamp?.toFixed(2) || 'N/A'}s, RPM: ${f.rpm?.toFixed(0) || 'N/A'}, Val: ${f.value !== undefined ? f.value : 'N/A'})`)
      .join('\n');

    return `Datalog Metadata:
- File: ${session.filename}
- Tune Map: ${session.tuneName || 'Custom'}
- Duration: ${session.durationSec?.toFixed(2) || 0}s
- Rows Sampled: ${session.rowsParsed || 0} (${session.avgIntervalSec ? (1/session.avgIntervalSec).toFixed(0) : 0} Hz)

Key Peak Stats:
- Max Boost: ${stats.maxBoost?.toFixed(1) || 'N/A'} psi
- Max RPM: ${stats.maxRpm ? Math.round(stats.maxRpm) : 'N/A'}
- Peak Load: ${stats.peakLoad?.toFixed(2) || 'N/A'} g/rev
- Ethanol Content: ${stats.ethanolPct !== undefined ? stats.ethanolPct.toFixed(1) + '%' : 'N/A'}
- Intake Air Temp Range: ${stats.iatMin?.toFixed(0) || 'N/A'}°F to ${stats.iatMax?.toFixed(0) || 'N/A'}°F
- Oil Temp Range: ${stats.oilTempMin?.toFixed(0) || 'N/A'}°F to ${stats.oilTempMax?.toFixed(0) || 'N/A'}°F

WOT Pulls Detected:
${pullSummaries || 'None'}

Engine Safety Flags / Anomalies:
${issues || 'None (Clean Log)'}`;
  }

  /**
   * Streams content from Google Gemini API
   */
  async function streamGemini(prompt, history = [], onChunk, onComplete, onError) {
    const key = getApiKey();
    if (!key) {
      onError(new Error('Gemini API key is not configured. Click "⚙️ Gemini AI" in the header to enter your key.'));
      return;
    }

    async function requestStream(model, requestBody) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (resp.ok) {
        return { resp, errorMessage: '' };
      }

      const errJson = await resp.json().catch(() => ({}));
      const msg = errJson.error?.message || `Gemini API error (HTTP ${resp.status})`;
      return { resp, errorMessage: msg };
    }

    const contents = [];
    
    // Add history if present
    for (const msg of history) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      });
    }

    // Add current prompt
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    const body = {
      contents,
      systemInstruction: {
        parts: [{ text: buildSystemPrompt() }]
      },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048
      }
    };

    try {
      let model = getModel();
      let { resp, errorMessage } = await requestStream(model, body);

      const modelUnavailable =
        (resp.status === 404 || /no longer available|not found/i.test(errorMessage));

      if (!resp.ok && modelUnavailable && model !== DEFAULT_MODEL) {
        setModel(DEFAULT_MODEL);
        model = DEFAULT_MODEL;
        ({ resp, errorMessage } = await requestStream(model, body));
      }

      if (!resp.ok) {
        throw new Error(errorMessage);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            if (jsonStr === '[DONE]') continue;
            try {
              const data = JSON.parse(jsonStr);
              const textChunk = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (textChunk) {
                accumulatedText += textChunk;
                if (onChunk) onChunk(textChunk, accumulatedText);
              }
            } catch (e) {
              // ignore parse errors for partial chunks
            }
          }
        }
      }

      if (onComplete) onComplete(accumulatedText);

    } catch (err) {
      if (onError) onError(err);
    }
  }

  /**
   * Generates a full master tuner analysis with Gemini for a single session
   */
  function generateSessionAnalysis(session, onChunk, onComplete, onError) {
    const telemetry = formatSessionTelemetry(session);
    const prompt = `Please perform a deep, comprehensive Master Tuner Calibration Review for the following Cobb AccessPort datalog:

${telemetry}

Structure your review as follows:
1. 🏁 Executive Calibrator Summary (Overall tune health and power delivery quality)
2. 🛡️ Ignition & Knock Assessment (Detailed breakdown of DAM, FBK, FKL and timing curves)
3. ⛽ Fueling, AFR & Direct Injection (Closed-loop/Open-loop transitions, AFR stability under boost, HPFP rail pressure)
4. 🚀 Boost & Wastegate Solenoid Dynamics (Spool rate, overshoot, wastegate tracking)
5. 🌡️ Thermal Headroom & Intercooler Efficiency (IAT rise during pulls, oil cooling)
6. 🔧 Actionable Tuner & Mechanical Recommendations (Specific map adjustments or hardware checks)`;

    return streamGemini(prompt, [], onChunk, onComplete, onError);
  }

  /**
   * Compares two sessions with Gemini
   */
  function compareSessionsAnalysis(sessionA, sessionB, onChunk, onComplete, onError) {
    const telA = formatSessionTelemetry(sessionA);
    const telB = formatSessionTelemetry(sessionB);

    const prompt = `Please perform an in-depth comparative tuning review between two Subaru FA24 Cobb AccessPort datalogs:

=== SESSION A (Baseline) ===
${telA}

=== SESSION B (Comparison) ===
${telB}

Please deliver:
1. 🏆 Comparative Calibrator Verdict (Which session was safer, which produced more power/boost, and why)
2. 📊 Key Delta Analysis (Ignition timing differences, Boost spool/peak comparison, AFR and thermal differences)
3. 🔍 Anomalies & Risk Comparison (Knock counts, fuel trim drift, pressure stability)
4. 🏁 Calibrator Recommendation (Next steps for tuning revision or hardware updates)`;

    return streamGemini(prompt, [], onChunk, onComplete, onError);
  }

  /**
   * Interactive Q&A chat with Gemini about the current session
   */
  function askGeminiChat(session, userQuery, conversationHistory, onChunk, onComplete, onError) {
    const telemetry = formatSessionTelemetry(session);
    const contextualPrompt = `Context for the current datalog being viewed:
${telemetry}

User Question: ${userQuery}`;

    return streamGemini(contextualPrompt, conversationHistory, onChunk, onComplete, onError);
  }

  return {
    getApiKey,
    setApiKey,
    hasApiKey,
    getModel,
    setModel,
    testApiKey,
    generateSessionAnalysis,
    compareSessionsAnalysis,
    askGeminiChat
  };

})();

