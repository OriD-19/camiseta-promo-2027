import type { Career, FondoId } from './config';

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Color inválido: ${hex}`);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(c: RGB): string {
  return (
    '#' +
    c
      .map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/** Luminancia relativa WCAG 2.x. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as RGB;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste WCAG entre dos colores (1–21). */
export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Mezcla lineal en sRGB: t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex(x.map((v, i) => v + (y[i]! - v) * t) as RGB);
}

export const FILL_HEX: Record<Exclude<FondoId, 'carrera'>, string> = {
  blanco: '#FFFFFF',
  negro: '#151515',
  beige: '#E6DAC3',
};

export const INK_DARK = '#F4F1EA';
export const INK_LIGHT = '#161616';

export interface ShirtColors {
  fill: string;
  ink: string;
  accent: string;
  stroke: string;
  dark: boolean;
}

/** Colores de la camiseta según carrera y fondo (SPEC §4). */
export function shirtColors(career: Pick<Career, 'color' | 'fondo'>, fondo: FondoId): ShirtColors {
  const fill = fondo === 'carrera' ? career.fondo : FILL_HEX[fondo];
  const dark = luminance(fill) < 0.3;
  const ink = dark ? INK_DARK : INK_LIGHT;
  // El color oficial va directo como acento; solo se aclara si casi no se distingue del fondo.
  const accent = dark && contrast(career.color, fill) < 3 ? mix(career.color, '#FFFFFF', 0.4) : career.color;
  const stroke = dark ? '#00000066' : '#0000002E';
  return { fill, ink, accent, stroke, dark };
}
