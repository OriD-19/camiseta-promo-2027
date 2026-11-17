import { describe, expect, it } from 'vitest';
import { buildVoteData, clean, errorMessage, isInstitutionalEmail, normalizeEmail, validateVote } from '../src/validate';

const okForm = { nombre: 'Ana Pérez', correo: 'ana.perez@esen.edu.sv', carrera: 'ISND', comentario: '' };
const okSel = { fondo: 'negro', logo: 'siglas', tipografia: 'archivo' };

describe('correo institucional', () => {
  it('acepta solo @esen.edu.sv, sin importar mayúsculas ni espacios', () => {
    expect(isInstitutionalEmail('ana@esen.edu.sv')).toBe(true);
    expect(isInstitutionalEmail('  Ana.Perez@ESEN.EDU.SV ')).toBe(true);
    expect(isInstitutionalEmail('ana@gmail.com')).toBe(false);
    expect(isInstitutionalEmail('ana@esen.edu.sv.com')).toBe(false);
    expect(isInstitutionalEmail('ana@sub.esen.edu.sv')).toBe(false);
    expect(isInstitutionalEmail('ana@esenXedu.sv')).toBe(false);
    expect(isInstitutionalEmail('@esen.edu.sv')).toBe(false);
    expect(isInstitutionalEmail('ana pérez@esen.edu.sv')).toBe(false);
  });

  it('normaliza a minúsculas', () => {
    expect(normalizeEmail(' Ana@ESEN.edu.sv ')).toBe('ana@esen.edu.sv');
  });
});

describe('clean', () => {
  it('colapsa espacios, quita controles y recorta', () => {
    expect(clean('  Ana \n\t Pérez  ', 80)).toBe('Ana Pérez');
    expect(clean('x'.repeat(100), 80)).toHaveLength(80);
    expect(clean(undefined, 10)).toBe('');
  });
});

describe('validateVote', () => {
  it('sin errores con datos válidos', () => {
    expect(validateVote(okForm, okSel)).toEqual([]);
  });

  it('reporta cada campo faltante en orden', () => {
    const errs = validateVote({ nombre: '  ', correo: '', carrera: '', comentario: '' }, okSel);
    expect(errs.map((e) => e.code)).toEqual(['nombre_requerido', 'correo_requerido', 'carrera_requerida']);
  });

  it('rechaza correos no institucionales', () => {
    const errs = validateVote({ ...okForm, correo: 'ana@gmail.com' }, okSel);
    expect(errs).toEqual([{ field: 'correo', code: 'correo_no_institucional' }]);
  });

  it('rechaza ids desconocidos', () => {
    expect(validateVote({ ...okForm, carrera: 'XYZ' }, okSel)[0]?.code).toBe('carrera_requerida');
    expect(validateVote(okForm, { ...okSel, logo: 'otro' })[0]?.code).toBe('valor_invalido_logo');
  });

  it('limita el comentario a 500', () => {
    expect(validateVote({ ...okForm, comentario: 'a'.repeat(501) }, okSel)[0]?.code).toBe('comentario_largo');
  });
});

describe('buildVoteData', () => {
  it('normaliza el payload', () => {
    const d = buildVoteData({ ...okForm, nombre: ' Ana   Pérez ', correo: 'ANA@esen.edu.sv' }, okSel);
    expect(d).toEqual({
      nombre: 'Ana Pérez',
      correo: 'ana@esen.edu.sv',
      carrera: 'ISND',
      fondo: 'negro',
      logo: 'siglas',
      tipografia: 'archivo',
      comentario: '',
      website: '',
    });
  });
});

describe('errorMessage (SPEC §7.3)', () => {
  it.each([
    ['votacion_cerrada', 'La votación está cerrada.'],
    ['nombre_requerido', 'Escribí tu nombre.'],
    ['correo_no_institucional', 'Usá tu correo institucional (@esen.edu.sv).'],
    ['correo_no_en_padron', 'Tu correo no aparece en la lista de la promoción. Escribile a tu representante.'],
    ['carrera_no_coincide', 'La carrera no coincide con la registrada para tu correo.'],
    ['valor_invalido_fondo', 'Algo salió mal con tu selección. Recargá la página.'],
    ['espera_unos_segundos', 'Ya recibimos tu voto. Esperá unos segundos antes de cambiarlo.'],
    ['servidor_ocupado', 'No pudimos enviar tu voto. Intentá de nuevo.'],
    ['error_interno', 'No pudimos enviar tu voto. Intentá de nuevo.'],
    ['red', 'No pudimos enviar tu voto. Intentá de nuevo.'],
    [undefined, 'No pudimos enviar tu voto. Intentá de nuevo.'],
  ])('%s', (code, msg) => {
    expect(errorMessage(code)).toBe(msg);
  });
});
