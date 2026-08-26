'use strict';

/**
 * Findings Module - COMPATIBILITY WRAPPER
 * 
 * This module now delegates to the new state-based RulesEngine.
 * Kept for backward compatibility with existing code.
 */

function runFindings(session) {
  // Delegate to new RulesEngine
  if (window.RulesEngine && window.RulesEngine.runFindings) {
    return window.RulesEngine.runFindings(session);
  }
  
  // Fallback if RulesEngine not loaded
  console.warn('RulesEngine not available; returning empty findings array');
  return [];
}

window.Findings = { runFindings };
