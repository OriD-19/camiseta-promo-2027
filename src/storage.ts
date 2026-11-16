/** Acceso a Web Storage que nunca rompe la página (modo privado, almacenamiento bloqueado, etc.). */
function safe(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readJSON<T>(key: string, kind: 'local' | 'session' = 'local'): T | null {
  try {
    const raw = safe(kind)?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown, kind: 'local' | 'session' = 'local'): void {
  try {
    safe(kind)?.setItem(key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento: se ignora */
  }
}

export function remove(key: string, kind: 'local' | 'session' = 'local'): void {
  try {
    safe(kind)?.removeItem(key);
  } catch {
    /* ignore */
  }
}
