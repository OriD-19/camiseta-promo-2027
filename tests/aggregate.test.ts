import { describe, expect, it } from 'vitest';
import {
  baseFor,
  byCareer,
  cleanVotes,
  comboLabel,
  combos,
  filterVotes,
  fmtPct,
  gapText,
  tally,
  toCSV,
  topCombos,
  winner,
  type RawVote,
  type Vote,
} from '../src/aggregate';

const V = (carrera: string, fondo: string, logo: string, tipografia: string, version = 'v1'): RawVote => ({
  carrera,
  fondo,
  logo,
  tipografia,
  version,
});

// Datos fijos: 10 votos válidos + 2 de versión vieja + 1 inválido.
const RAW: RawVote[] = [
  V('ISND', 'negro', 'siglas', 'bebas'),
  V('ISND', 'negro', 'siglas', 'bebas'),
  V('ISND', 'carrera', 'insignia', 'mono'),
  V('LEN', 'negro', 'siglas', 'bebas'),
  V('LEN', 'blanco', 'linea', 'montserrat'),
  V('LEN', 'blanco', 'linea', 'montserrat'),
  V('LCJ', 'carrera', 'siglas', 'bebas'),
  V('LCJ', 'carrera', 'frase', 'playfair'),
  V('IDN', 'negro', 'linea', 'montserrat'),
  V('IDN', 'carrera', 'siglas', 'graduate'),
  V('LEN', 'gris', 'siglas', 'bebas', 'v0'),
  V('IDN', 'negro', 'escudo', 'mono', 'v0'),
  V('ISND', 'negro', 'otro', 'bebas', 'v1'),
];
const INSCRITOS = { LEN: 38, LCJ: 27, IDN: 30, ISND: 30 };
const { votes, oldVersion, invalid } = cleanVotes(RAW);

describe('cleanVotes', () => {
  it('excluye por completo los votos de versiones viejas y los ids inválidos', () => {
    expect(votes).toHaveLength(10);
    expect(oldVersion).toBe(2);
    expect(invalid).toBe(1);
    expect(votes.every((v) => v.version === 'v1')).toBe(true);
  });

  it('acepta otra versión explícita', () => {
    expect(cleanVotes(RAW, 'v0').votes).toHaveLength(0); // ids de v0 no existen en config
    expect(cleanVotes(RAW, 'v0').oldVersion).toBe(11);
  });
});

describe('tally y ganadores', () => {
  it('cuenta fondos, incluye opciones con 0 y ordena de mayor a menor', () => {
    const t = tally(votes, 'fondo');
    expect(t.map((x) => [x.id, x.count])).toEqual([
      ['negro', 4],
      ['carrera', 4],
      ['blanco', 2],
      ['beige', 0],
    ]);
  });

  it('desempata por el orden de config', () => {
    // negro (índice 1) va antes que carrera (índice 3) con 4 votos cada uno.
    const w = winner(tally(votes, 'fondo'))!;
    expect(w.id).toBe('negro');
    expect(w.lead).toBe(0);
    expect(gapText(w)).toBe('empate con Color de la carrera');
  });

  it('calcula ventaja sobre el segundo', () => {
    const w = winner(tally(votes, 'logo'))!;
    expect([w.id, w.count, w.lead, w.runnerUp?.id]).toEqual(['siglas', 5, 2, 'linea']);
    expect(gapText(w)).toBe('+2 sobre Siglas + línea');
    const t = winner(tally(votes, 'tipografia'))!;
    expect([t.id, t.label, t.count]).toEqual(['bebas', 'Bebas Neue', 4]);
    expect(gapText(t)).toBe('+1 sobre Montserrat');
  });

  it('sin votos no hay ganador', () => {
    expect(winner(tally([], 'logo'))).toBeNull();
  });
});

describe('combinaciones', () => {
  it('top 3 por votos con desempate por config', () => {
    const top = topCombos(votes);
    expect(top.map((c) => [comboLabel(c), c.count])).toEqual([
      ['Negro · Siglas + 2027 · Bebas Neue', 3],
      ['Blanco · Siglas + línea · Montserrat', 2],
      // Todas las demás tienen 1 voto: gana la que va primero en config (negro < carrera).
      ['Negro · Siglas + línea · Montserrat', 1],
    ]);
  });

  it('la suma de combos es el total de votos', () => {
    expect(combos(votes).reduce((a, c) => a + c.count, 0)).toBe(10);
  });

  it('desempate completo: fondo, luego logo, luego tipografía', () => {
    const vs = cleanVotes([
      V('LEN', 'carrera', 'siglas', 'mono'),
      V('LEN', 'carrera', 'siglas', 'bebas'),
      V('LEN', 'carrera', 'linea', 'bebas'),
      V('LEN', 'blanco', 'insignia', 'mono'),
    ]).votes;
    expect(combos(vs).map((c) => `${c.fondo}/${c.logo}/${c.tipografia}`)).toEqual([
      'blanco/insignia/mono',
      'carrera/siglas/bebas',
      'carrera/siglas/mono',
      'carrera/linea/bebas',
    ]);
  });
});

describe('filtro y participación', () => {
  it('filtra por carrera', () => {
    expect(filterVotes(votes, 'todas')).toHaveLength(10);
    expect(filterVotes(votes, 'LEN')).toHaveLength(3);
    expect(filterVotes(votes, 'LCJ')).toHaveLength(2);
  });

  it('calcula la base de inscritos', () => {
    expect(baseFor(INSCRITOS, 'todas')).toBe(125);
    expect(baseFor(INSCRITOS, 'ISND')).toBe(30);
    expect(baseFor({}, 'todas')).toBe(0);
  });

  it('formatea porcentajes y tolera denominador 0', () => {
    expect(fmtPct(10, 125)).toBe('8%');
    expect(fmtPct(1, 3)).toBe('33%');
    expect(fmtPct(5, 0)).toBe('0%');
  });
});

describe('byCareer', () => {
  it('desglosa participación y preferencias por carrera', () => {
    const rows = byCareer(votes, INSCRITOS);
    expect(rows.map((r) => r.id)).toEqual(['LEN', 'LCJ', 'IDN', 'ISND']);
    const len = rows[0]!;
    expect([len.votos, len.inscritos, len.fondo, len.logo, len.tipografia]).toEqual([3, 38, 'Blanco', 'Siglas + línea', 'Montserrat']);
    expect(len.combo && [comboLabel(len.combo), len.combo.count]).toEqual(['Blanco · Siglas + línea · Montserrat', 2]);
    const isnd = rows[3]!;
    expect([isnd.votos, isnd.fondo, isnd.combo?.count]).toEqual([3, 'Negro', 2]);
  });

  it('carrera sin votos queda en null', () => {
    const rows = byCareer(filterVotes(votes, 'LEN'), INSCRITOS);
    expect(rows[1]).toEqual({ id: 'LCJ', votos: 0, inscritos: 27, fondo: null, logo: null, tipografia: null, combo: null });
  });
});

describe('toCSV', () => {
  it('exporta solo columnas anónimas', () => {
    const csv = toCSV(votes.slice(0, 2));
    expect(csv).toBe('carrera,fondo,logo,tipografia,version\r\nISND,negro,siglas,bebas,v1\r\nISND,negro,siglas,bebas,v1\r\n');
    expect(csv).not.toMatch(/nombre|correo/);
  });

  it('escapa comas, comillas y fórmulas', () => {
    const weird = [{ carrera: 'a,b', fondo: '"x"', logo: '=1+1', tipografia: 'ok', version: 'v1' }] as unknown as Vote[];
    expect(toCSV(weird).split('\r\n')[1]).toBe(`"a,b","""x""",'=1+1,ok,v1`);
  });
});
