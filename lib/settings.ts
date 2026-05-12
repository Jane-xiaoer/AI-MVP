/**
 * Client-side settings: master password + BYOK Gemini key.
 * Stored in localStorage; never sent except via /api/generate Authorization headers.
 */

const LS_MASTER = 'headshot.masterKey';
const LS_BYOK = 'headshot.userApiKey';

export type AccessMode = 'master' | 'byok' | 'free';

export function readMasterKey(): string {
  try {
    return localStorage.getItem(LS_MASTER) || '';
  } catch {
    return '';
  }
}

export function readUserApiKey(): string {
  try {
    return localStorage.getItem(LS_BYOK) || '';
  } catch {
    return '';
  }
}

export function saveSettings(masterKey: string, userApiKey: string): void {
  try {
    if (masterKey) localStorage.setItem(LS_MASTER, masterKey);
    else localStorage.removeItem(LS_MASTER);
    if (userApiKey) localStorage.setItem(LS_BYOK, userApiKey);
    else localStorage.removeItem(LS_BYOK);
  } catch {
    // ignore (private browsing)
  }
}

export function currentMode(): AccessMode {
  if (readMasterKey()) return 'master';
  if (readUserApiKey().startsWith('AIza')) return 'byok';
  return 'free';
}
