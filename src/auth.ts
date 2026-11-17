/**
 * Lógica pura del ID token de Google en el cliente.
 * Solo se lee para mostrar la cuenta y saber si ya venció: la verificación real
 * (firma, audiencia y lista de representantes) la hace el servidor.
 */

export interface IdClaims {
  email?: string;
  name?: string;
  exp?: number;
}

function base64UrlDecode(part: string): string {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Devuelve las claims del JWT sin verificarlo, o null si no tiene forma de JWT. */
export function decodeIdToken(token: string | null | undefined): IdClaims | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const claims = JSON.parse(base64UrlDecode(parts[1])) as unknown;
    return claims && typeof claims === 'object' ? (claims as IdClaims) : null;
  } catch {
    return null;
  }
}

/**
 * true si el token no sirve o vence en menos de `skewS` segundos.
 * El margen evita mandar un token que vence en camino al servidor.
 */
export function isTokenExpired(token: string | null | undefined, nowMs = Date.now(), skewS = 60): boolean {
  const exp = decodeIdToken(token)?.exp;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return true;
  return exp * 1000 - skewS * 1000 <= nowMs;
}
