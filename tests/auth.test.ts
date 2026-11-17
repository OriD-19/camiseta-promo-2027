import { describe, expect, it } from 'vitest';
import { decodeIdToken, isTokenExpired } from '../src/auth';

const b64url = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const jwt = (claims: object) => `${b64url('{"alg":"RS256"}')}.${b64url(JSON.stringify(claims))}.firma`;

describe('decodeIdToken', () => {
  it('lee las claims, incluidos acentos', () => {
    const t = jwt({ email: 'ana@esen.edu.sv', name: 'Ana Muñoz', exp: 1_900_000_000 });
    expect(decodeIdToken(t)).toEqual({ email: 'ana@esen.edu.sv', name: 'Ana Muñoz', exp: 1_900_000_000 });
  });

  it('devuelve null con basura', () => {
    expect(decodeIdToken('')).toBeNull();
    expect(decodeIdToken(null)).toBeNull();
    expect(decodeIdToken('no-es-un-jwt')).toBeNull();
    expect(decodeIdToken('a.%%%.c')).toBeNull();
    expect(decodeIdToken(`a.${b64url('"texto"')}.c`)).toBeNull();
  });
});

describe('isTokenExpired', () => {
  const now = 1_800_000_000_000;
  const exp = now / 1000;

  it('vigente si falta más que el margen', () => {
    expect(isTokenExpired(jwt({ exp: exp + 3600 }), now)).toBe(false);
  });

  it('vencido dentro del margen de 60 s o después', () => {
    expect(isTokenExpired(jwt({ exp: exp + 30 }), now)).toBe(true);
    expect(isTokenExpired(jwt({ exp: exp - 1 }), now)).toBe(true);
  });

  it('vencido si no hay exp o el token no sirve', () => {
    expect(isTokenExpired(jwt({ email: 'x@y.z' }), now)).toBe(true);
    expect(isTokenExpired('basura', now)).toBe(true);
    expect(isTokenExpired(null, now)).toBe(true);
  });
});
