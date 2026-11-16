/**
 * Backend simulado para desarrollar sin Apps Script (VITE_APPS_SCRIPT_URL vacío).
 * Imita las respuestas de apps-script/Code.gs. Los datos de resultados son deterministas,
 * como en reference/prototipo/Resultados.dc.html.
 *
 * Para probar estados: agregá ?mock=cerrada a la URL para simular la votación cerrada.
 */
import { CAREERS, FONDOS, FONTS, LOGOS, OPTIONS_VERSION, isCareerId, isFondoId, isFontId, isLogoId } from './config';
import type { Inscritos, Payload, ResultsData, Transport, VoteRow } from './api';
import { EMAIL_RE, MAX, clean, normalizeEmail } from './validate';

export const MOCK_INSCRITOS: Inscritos = { LEN: 38, LCJ: 27, IDN: 30, ISND: 30 };

/** PRNG mulberry32, igual que el prototipo. */
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleVotes(seed = 2027): VoteRow[] {
  const rnd = rng(seed);
  const pick = (ids: readonly string[], w: number[]): string => {
    let r = rnd() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ids.length; i++) {
      r -= w[i]!;
      if (r <= 0) return ids[i]!;
    }
    return ids[ids.length - 1]!;
  };
  const rates: Record<string, number> = { LEN: 0.79, LCJ: 0.74, IDN: 0.83, ISND: 0.9 };
  const out: VoteRow[] = [];
  for (const c of CAREERS) {
    const n = Math.round(MOCK_INSCRITOS[c.id] * rates[c.id]!);
    for (let i = 0; i < n; i++) {
      out.push({
        carrera: c.id,
        fondo: pick(FONDOS.map((f) => f.id), [20, 34, 14, 32]),
        logo: pick(LOGOS.map((l) => l.id), [36, 26, 18, 20]),
        tipografia: pick(FONTS.map((f) => f.id), [32, 26, 18, 9, 15]),
        version: OPTIONS_VERSION,
      });
    }
  }
  // Unos pocos votos de una versión anterior, para ver el aviso en el dashboard.
  out.push(
    { carrera: 'LEN', fondo: 'gris', logo: 'siglas', tipografia: 'bebas', version: 'v0' },
    { carrera: 'IDN', fondo: 'negro', logo: 'escudo', tipografia: 'mono', version: 'v0' },
  );
  return out;
}

const SAMPLE_COMMENTS = [
  { carrera: 'ISND', texto: 'Me gusta más con la insignia, se ve más formal.' },
  { carrera: 'LEN', texto: 'Propuesta de frase: «Hechos para trascender».' },
  { carrera: 'LCJ', texto: 'Que el fondo negro no sea muy grueso, hace calor.' },
  { carrera: 'IDN', texto: 'Frase: «Lo que empezamos juntos».' },
  { carrera: 'ISND', texto: 'Bebas Neue se lee mejor de lejos.' },
];

export function sampleResults(): ResultsData {
  return {
    version: OPTIONS_VERSION,
    open: true,
    votes: sampleVotes(),
    inscritos: { ...MOCK_INSCRITOS },
    comentarios: SAMPLE_COMMENTS.map((c) => ({ ...c })),
  };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createMockBackend(opts: { latencyMs?: number; open?: boolean } = {}): Transport {
  const latency = opts.latencyMs ?? 700;
  const closed =
    opts.open === false ||
    (typeof location !== 'undefined' && new URLSearchParams(location.search).get('mock') === 'cerrada');
  const seen = new Map<string, number>();

  return async (payload: Payload) => {
    await delay(latency);
    switch (payload.action) {
      case 'status':
        return { ok: true, open: !closed, version: OPTIONS_VERSION };
      case 'vote': {
        if (closed) return { ok: false, error: 'votacion_cerrada' };
        const d = payload.data;
        if (d.website) return { ok: true, updated: false };
        if (!clean(d.nombre, MAX.nombre)) return { ok: false, error: 'nombre_requerido' };
        const correo = normalizeEmail(d.correo);
        if (!EMAIL_RE.test(correo)) return { ok: false, error: 'correo_no_institucional' };
        if (!isCareerId(d.carrera)) return { ok: false, error: 'valor_invalido_carrera' };
        if (!isFondoId(d.fondo)) return { ok: false, error: 'valor_invalido_fondo' };
        if (!isLogoId(d.logo)) return { ok: false, error: 'valor_invalido_logo' };
        if (!isFontId(d.tipografia)) return { ok: false, error: 'valor_invalido_tipografia' };
        const last = seen.get(correo);
        const now = Date.now();
        if (last && now - last < 10_000) return { ok: false, error: 'espera_unos_segundos' };
        seen.set(correo, now);
        return { ok: true, updated: last !== undefined };
      }
      case 'results':
        if (!payload.key || !payload.key.trim()) return { ok: false, error: 'no_autorizado' };
        return { ok: true, ...sampleResults() };
    }
  };
}
