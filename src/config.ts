/**
 * ÚNICA fuente de verdad de opciones, colores y posición del logo.
 * Si cambian los ids, actualizar ALLOWED en apps-script/Code.gs y subir OPTIONS_VERSION en ambos.
 */
export const OPTIONS_VERSION = 'v1';

export const CAREERS = [
  { id: 'LEN',  nombre: 'Licenciatura en Economía y Negocios',          color: '#EE803C', fondo: '#4C1F00' },
  { id: 'LCJ',  nombre: 'Licenciatura en Ciencias Jurídicas',            color: '#D61A28', fondo: '#5C0008' },
  { id: 'IDN',  nombre: 'Ingeniería de Negocios',                        color: '#2BAC6E', fondo: '#01381F' },
  { id: 'ISND', nombre: 'Ingeniería de Software y Negocios Digitales',   color: '#00AFAC', fondo: '#003635' },
] as const;

export const FONDOS = [
  { id: 'blanco',  label: 'Blanco',              hex: '#FFFFFF' },
  { id: 'negro',   label: 'Negro',               hex: '#151515' },
  { id: 'beige',   label: 'Beige',               hex: '#E6DAC3' },
  { id: 'carrera', label: 'Color de la carrera', hex: null }, // usa CAREERS[].fondo
] as const;

export const LOGOS = [
  { id: 'siglas',   label: 'Siglas + 2027',  desc: 'Lo más directo' },
  { id: 'linea',    label: 'Siglas + línea', desc: 'Con «PROMO 2027»' },
  { id: 'frase',    label: 'Frase + siglas', desc: 'Incluye una frase común' },
  { id: 'insignia', label: 'Insignia',       desc: 'Sello circular' },
] as const;

export const FONTS = [
  { id: 'bebas',      nombre: 'Bebas Neue',       desc: 'Condensada',        family: "'Bebas Neue', sans-serif",     weight: 400, tracking: '0.04em' },
  { id: 'montserrat', nombre: 'Montserrat',       desc: 'Geométrica',        family: "'Montserrat', sans-serif",     weight: 800, tracking: '0em' },
  { id: 'graduate',   nombre: 'Graduate',         desc: 'Varsity / college', family: "'Graduate', serif",            weight: 400, tracking: '0.02em' },
  { id: 'playfair',   nombre: 'Playfair Display', desc: 'Serif clásica',     family: "'Playfair Display', serif",    weight: 800, tracking: '0em' },
  { id: 'mono',       nombre: 'Space Mono',       desc: 'Monoespaciada',     family: "'Space Mono', monospace",      weight: 700, tracking: '-0.02em' },
] as const;

export const FRASE = '[FRASE CANDIDATA]'; // pendiente de definir

// Posición del logo en el pecho, en % del ancho/alto de la camiseta.
// Se ajusta a mano; también se expone como variables CSS (--logo-left, --logo-top, --logo-width).
export const LOGO_POSITION = { left: 52, top: 25, width: 24 };

export const EMAIL_DOMAIN = 'esen.edu.sv';

export type Career = (typeof CAREERS)[number];
export type CareerId = Career['id'];
export type Fondo = (typeof FONDOS)[number];
export type FondoId = Fondo['id'];
export type Logo = (typeof LOGOS)[number];
export type LogoId = Logo['id'];
export type Font = (typeof FONTS)[number];
export type FontId = Font['id'];

export const findCareer = (id: string): Career | undefined => CAREERS.find((c) => c.id === id);
export const findFondo = (id: string): Fondo | undefined => FONDOS.find((f) => f.id === id);
export const findLogo = (id: string): Logo | undefined => LOGOS.find((l) => l.id === id);
export const findFont = (id: string): Font | undefined => FONTS.find((f) => f.id === id);

export const isCareerId = (v: unknown): v is CareerId => typeof v === 'string' && !!findCareer(v);
export const isFondoId = (v: unknown): v is FondoId => typeof v === 'string' && !!findFondo(v);
export const isLogoId = (v: unknown): v is LogoId => typeof v === 'string' && !!findLogo(v);
export const isFontId = (v: unknown): v is FontId => typeof v === 'string' && !!findFont(v);
