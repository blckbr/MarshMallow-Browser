export const GAME_MODE_DEFAULT = Object.freeze({ mode:'auto', saveResourcesInBackground:false });

export function sanitizeGameDomainSetting(value = {}) {
  const mode = ['auto','on','off'].includes(String(value?.mode)) ? String(value.mode) : 'auto';
  return { mode, saveResourcesInBackground:Boolean(value?.saveResourcesInBackground) };
}

export function resolveGameMode({ preference = 'auto', signals = {} } = {}) {
  const mode = ['auto','on','off'].includes(String(preference)) ? String(preference) : 'auto';
  const reasons = [];
  let score = 0;
  const add = (condition, points, name) => { if (condition) { score += points; reasons.push(name); } };
  add(Boolean(signals.largeCanvas), 3, 'large-canvas');
  add(Boolean(signals.webgl), 3, 'webgl');
  add(Boolean(signals.pointerLock), 3, 'pointer-lock');
  add(Boolean(signals.keyboardLock), 2, 'keyboard-lock');
  add(Boolean(signals.fullscreen), 1, 'fullscreen');
  add(Number(signals.rafRate || 0) >= 25, 2, 'animation-loop');
  add(Boolean(signals.gamepad), 1, 'gamepad');
  if (mode === 'off') return { active:false, score, reasons:['manual-off', ...reasons] };
  if (mode === 'on') return { active:true, score, reasons:['manual-on', ...reasons] };
  return { active:score >= 5, score, reasons };
}

export function resolveWindowBackgroundPolicy(tabs = []) {
  const demandingTabIds = (Array.isArray(tabs) ? tabs : [])
    .filter((tab) => tab && tab.gameActive && !tab.saveResourcesInBackground)
    .map((tab) => String(tab.id));
  return { continuous:demandingTabIds.length > 0, demandingTabIds };
}

export function hostnameKey(value) {
  try { return new URL(String(value || '')).hostname.toLowerCase().replace(/^www\./,''); } catch { return ''; }
}
