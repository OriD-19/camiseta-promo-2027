/**
 * Agregación de resultados (puro, sin DOM). Toda la lógica del dashboard sale de acá.
 * Empates: se ordena por votos y, a igualdad, por el orden de config.
 */
import {
  CAREERS,
  FONDOS,
  FONTS,
  LOGOS,
  OPTIONS_VERSION,
  isCareerId,
  isFondoId,
  isFontId,
  isLogoId,
  type CareerId,
  type FondoId,
  type FontId,
  type LogoId,
} from './config';

export interface Vote {
  carrera: CareerId;
  fondo: FondoId;
  logo: LogoId;
  tipografia: FontId;
  version: string;
}

export interface RawVote {
  carrera: unknown;
  fondo: unknown;
  logo: unknown;
  tipografia: unknown;
  version: unknown;
}

export interface Cleaned {
  votes: Vote[];
  /** Votos con `version` distinta de OPTIONS_VERSION: se excluyen de todo. */
  oldVersion: number;
  /** Votos de la versión actual pero con algún id desconocido (no debería pasar). */
  invalid: number;
}

/** Deja solo los votos de la versión actual con ids válidos. */
export function cleanVotes(raw: readonly RawVote[], version: string = OPTIONS_VERSION): Cleaned {
  const votes: Vote[] = [];
  let oldVersion = 0;
  let invalid = 0;
  for (const r of raw) {
    if (String(r.version ?? '') !== version) {
      oldVersion++;
      continue;
    }
    if (isCareerId(r.carrera) && isFondoId(r.fondo) && isLogoId(r.logo) && isFontId(r.tipografia)) {
      votes.push({ carrera: r.carrera, fondo: r.fondo, logo: r.logo, tipografia: r.tipografia, version });
    } else {
      invalid++;
    }
  }
  return { votes, oldVersion, invalid };
}

export type Filter = 'todas' | CareerId;

export function filterVotes(votes: readonly Vote[], filter: Filter): Vote[] {
  return filter === 'todas' ? votes.slice() : votes.filter((v) => v.carrera === filter);
}

/** Fracción 0–1; 0 si el denominador es 0. */
export function ratio(n: number, d: number): number {
  return d > 0 ? n / d : 0;
}

/** "42%" (redondeado). */
export function fmtPct(n: number, d: number): string {
  return `${Math.round(ratio(n, d) * 100)}%`;
}

/* ------------------------------------------------------------------ */
/* Conteo por variable                                                 */
/* ------------------------------------------------------------------ */

export type VarKey = 'fondo' | 'logo' | 'tipografia';

export interface TallyItem {
  id: string;
  label: string;
  count: number;
  /** Índice en config, para desempatar. */
  order: number;
}

const OPTIONS: Record<VarKey, readonly { id: string; label: string }[]> = {
  fondo: FONDOS,
  logo: LOGOS,
  tipografia: FONTS.map((f) => ({ id: f.id, label: f.nombre })),
};

export function optionLabel(key: VarKey, id: string): string {
  return OPTIONS[key].find((o) => o.id === id)?.label ?? id;
}

const byCountThenOrder = (a: { count: number; order: number }, b: { count: number; order: number }) =>
  b.count - a.count || a.order - b.order;

/** Todas las opciones de una variable (incluidas las de 0 votos), de mayor a menor. */
export function tally(votes: readonly Vote[], key: VarKey): TallyItem[] {
  const items = OPTIONS[key].map((o, order) => ({ id: o.id, label: o.label, count: 0, order }));
  const idx = new Map(items.map((it) => [it.id, it]));
  for (const v of votes) {
    const it = idx.get(v[key]);
    if (it) it.count++;
  }
  return items.sort(byCountThenOrder);
}

export interface Winner {
  id: string;
  label: string;
  count: number;
  /** Ventaja sobre el segundo (0 = empate). */
  lead: number;
  runnerUp: { id: string; label: string; count: number } | null;
}

/** Ganador de una variable, o null si no hay votos. */
export function winner(t: readonly TallyItem[]): Winner | null {
  const [a, b] = t;
  if (!a || a.count === 0) return null;
  return {
    id: a.id,
    label: a.label,
    count: a.count,
    lead: a.count - (b?.count ?? 0),
    runnerUp: b ? { id: b.id, label: b.label, count: b.count } : null,
  };
}

/** "+N sobre X" o "empate con X". */
export function gapText(w: Winner): string {
  if (!w.runnerUp) return `+${w.lead}`;
  return w.lead === 0 ? `empate con ${w.runnerUp.label}` : `+${w.lead} sobre ${w.runnerUp.label}`;
}

/* ------------------------------------------------------------------ */
/* Combinaciones                                                       */
/* ------------------------------------------------------------------ */

export interface Combo {
  fondo: FondoId;
  logo: LogoId;
  tipografia: FontId;
  count: number;
}

const orderOf = {
  fondo: new Map(FONDOS.map((f, i) => [f.id as string, i])),
  logo: new Map(LOGOS.map((l, i) => [l.id as string, i])),
  tipografia: new Map(FONTS.map((f, i) => [f.id as string, i])),
};

/** Combinaciones fondo+logo+tipografía con votos, de mayor a menor (desempate por orden de config). */
export function combos(votes: readonly Vote[]): Combo[] {
  const m = new Map<string, Combo>();
  for (const v of votes) {
    const k = `${v.fondo}|${v.logo}|${v.tipografia}`;
    const c = m.get(k);
    if (c) c.count++;
    else m.set(k, { fondo: v.fondo, logo: v.logo, tipografia: v.tipografia, count: 1 });
  }
  return [...m.values()].sort(
    (a, b) =>
      b.count - a.count ||
      orderOf.fondo.get(a.fondo)! - orderOf.fondo.get(b.fondo)! ||
      orderOf.logo.get(a.logo)! - orderOf.logo.get(b.logo)! ||
      orderOf.tipografia.get(a.tipografia)! - orderOf.tipografia.get(b.tipografia)!,
  );
}

export function topCombos(votes: readonly Vote[], n = 3): Combo[] {
  return combos(votes).slice(0, n);
}

export function comboLabel(c: Pick<Combo, 'fondo' | 'logo' | 'tipografia'>): string {
  return `${optionLabel('fondo', c.fondo)} · ${optionLabel('logo', c.logo)} · ${optionLabel('tipografia', c.tipografia)}`;
}

/* ------------------------------------------------------------------ */
/* Participación y desglose por carrera                                */
/* ------------------------------------------------------------------ */

export type Inscritos = Partial<Record<CareerId, number>>;

export function baseFor(inscritos: Inscritos, filter: Filter): number {
  if (filter !== 'todas') return Math.max(0, Number(inscritos[filter]) || 0);
  return CAREERS.reduce((a, c) => a + Math.max(0, Number(inscritos[c.id]) || 0), 0);
}

export interface CareerRow {
  id: CareerId;
  votos: number;
  inscritos: number;
  fondo: string | null;
  logo: string | null;
  tipografia: string | null;
  combo: Combo | null;
}

/** Una fila por carrera, siempre sobre todos los votos (no depende del filtro). */
export function byCareer(votes: readonly Vote[], inscritos: Inscritos): CareerRow[] {
  return CAREERS.map((c) => {
    const rs = votes.filter((v) => v.carrera === c.id);
    return {
      id: c.id,
      votos: rs.length,
      inscritos: baseFor(inscritos, c.id),
      fondo: winner(tally(rs, 'fondo'))?.label ?? null,
      logo: winner(tally(rs, 'logo'))?.label ?? null,
      tipografia: winner(tally(rs, 'tipografia'))?.label ?? null,
      combo: combos(rs)[0] ?? null,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Exportar                                                            */
/* ------------------------------------------------------------------ */

function csvCell(v: unknown): string {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // evita inyección de fórmulas en Excel
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV anónimo: carrera,fondo,logo,tipografia,version. */
export function toCSV(votes: readonly Vote[]): string {
  const header = 'carrera,fondo,logo,tipografia,version';
  const lines = votes.map((v) => [v.carrera, v.fondo, v.logo, v.tipografia, v.version].map(csvCell).join(','));
  return [header, ...lines].join('\r\n') + '\r\n';
}
