import { describe, expect, it } from 'vitest';
import { contrast, hexToRgb, luminance, mix, rgbToHex, shirtColors } from '../src/colors';
import { CAREERS, FONDOS, findCareer } from '../src/config';

const career = (id: string) => findCareer(id)!;

describe('helpers de color', () => {
  it('convierte hex ↔ rgb', () => {
    expect(hexToRgb('#00AFAC')).toEqual([0, 175, 172]);
    expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
    expect(hexToRgb('#00000066')).toEqual([0, 0, 0]);
    expect(rgbToHex([0, 175, 172])).toBe('#00AFAC');
    expect(() => hexToRgb('nope')).toThrow();
  });

  it('calcula luminancia en los extremos', () => {
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 5);
    expect(luminance('#000000')).toBeCloseTo(0, 5);
  });

  it('calcula contraste WCAG', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
    expect(contrast('#EE803C', '#FFFFFF')).toBeCloseTo(contrast('#FFFFFF', '#EE803C'), 10);
  });

  it('mezcla colores', () => {
    expect(mix('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mix('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mix('#D61A28', '#FFFFFF', 0.4)).toBe('#E6767E');
  });
});

describe('shirtColors', () => {
  it('usa el fill fijo de cada fondo y el de la carrera con "carrera"', () => {
    const c = career('ISND');
    expect(shirtColors(c, 'blanco').fill).toBe('#FFFFFF');
    expect(shirtColors(c, 'negro').fill).toBe('#151515');
    expect(shirtColors(c, 'beige').fill).toBe('#E6DAC3');
    expect(shirtColors(c, 'carrera').fill).toBe(c.fondo);
  });

  it('blanco y beige son claros: tinta oscura, stroke suave y acento original', () => {
    for (const c of CAREERS) {
      for (const f of ['blanco', 'beige'] as const) {
        const s = shirtColors(c, f);
        expect(s.dark).toBe(false);
        expect(s.ink).toBe('#161616');
        expect(s.stroke).toBe('#0000002E');
        expect(s.accent).toBe(c.color);
      }
    }
  });

  it('negro y fondos de carrera son oscuros: tinta clara y stroke fuerte', () => {
    for (const c of CAREERS) {
      for (const f of ['negro', 'carrera'] as const) {
        const s = shirtColors(c, f);
        expect(s.dark).toBe(true);
        expect(s.ink).toBe('#F4F1EA');
        expect(s.stroke).toBe('#00000066');
      }
    }
  });

  it('solo aclara el acento del rojo LCJ sobre su fondo vino', () => {
    const lightened: string[] = [];
    for (const c of CAREERS) {
      for (const f of FONDOS) {
        const s = shirtColors(c, f.id);
        if (s.accent !== c.color) lightened.push(`${c.id}/${f.id}`);
      }
    }
    expect(lightened).toEqual(['LCJ/carrera']);
    const lcj = shirtColors(career('LCJ'), 'carrera');
    expect(lcj.accent).toBe(mix('#D61A28', '#FFFFFF', 0.4));
    expect(contrast(lcj.accent, lcj.fill)).toBeGreaterThan(contrast('#D61A28', lcj.fill));
  });

  it('la tinta siempre contrasta ≥ 4.5:1 con el fill', () => {
    for (const c of CAREERS) {
      for (const f of FONDOS) {
        const s = shirtColors(c, f.id);
        expect(contrast(s.ink, s.fill)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
