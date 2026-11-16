import { EMAIL_DOMAIN, isCareerId, isFondoId, isFontId, isLogoId } from './config';

export const MAX = { nombre: 80, comentario: 500 } as const;

// Mismo patrón que EMAIL_RE en apps-script/Code.gs.
export const EMAIL_RE = new RegExp(`^[a-z0-9._%+-]+@${EMAIL_DOMAIN.replace(/\./g, '\\.')}$`);

/** Igual que clean_() del backend: quita caracteres de control, colapsa espacios y recorta. */
export function clean(s: unknown, max: number): string {
  return String(s ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function normalizeEmail(s: unknown): string {
  return String(s ?? '').trim().toLowerCase();
}

export function isInstitutionalEmail(s: unknown): boolean {
  return EMAIL_RE.test(normalizeEmail(s));
}

export interface VoteForm {
  nombre: string;
  correo: string;
  carrera: string;
  comentario: string;
}

export interface VoteSelection {
  fondo: string;
  logo: string;
  tipografia: string;
}

export type Field = 'nombre' | 'correo' | 'carrera' | 'comentario' | 'seleccion';

export interface FieldError {
  field: Field;
  code: string;
}

export interface VoteData {
  nombre: string;
  correo: string;
  carrera: string;
  fondo: string;
  logo: string;
  tipografia: string;
  comentario: string;
  website: string;
}

/** Valida en el cliente. Devuelve los errores en el orden de los campos del formulario. */
export function validateVote(form: VoteForm, sel: VoteSelection): FieldError[] {
  const errors: FieldError[] = [];
  if (!clean(form.nombre, MAX.nombre)) errors.push({ field: 'nombre', code: 'nombre_requerido' });
  const correo = normalizeEmail(form.correo);
  if (!correo) errors.push({ field: 'correo', code: 'correo_requerido' });
  else if (!EMAIL_RE.test(correo)) errors.push({ field: 'correo', code: 'correo_no_institucional' });
  if (!isCareerId(form.carrera)) errors.push({ field: 'carrera', code: 'carrera_requerida' });
  if (String(form.comentario ?? '').trim().length > MAX.comentario)
    errors.push({ field: 'comentario', code: 'comentario_largo' });
  if (!isFondoId(sel.fondo)) errors.push({ field: 'seleccion', code: 'valor_invalido_fondo' });
  else if (!isLogoId(sel.logo)) errors.push({ field: 'seleccion', code: 'valor_invalido_logo' });
  else if (!isFontId(sel.tipografia)) errors.push({ field: 'seleccion', code: 'valor_invalido_tipografia' });
  return errors;
}

/** Arma el payload normalizado que se manda al backend. */
export function buildVoteData(form: VoteForm, sel: VoteSelection, website = ''): VoteData {
  return {
    nombre: clean(form.nombre, MAX.nombre),
    correo: normalizeEmail(form.correo),
    carrera: form.carrera.trim(),
    fondo: sel.fondo,
    logo: sel.logo,
    tipografia: sel.tipografia,
    comentario: clean(form.comentario, MAX.comentario),
    website,
  };
}

const MESSAGES: Record<string, string> = {
  votacion_cerrada: 'La votación está cerrada.',
  nombre_requerido: 'Escribí tu nombre.',
  correo_requerido: 'Escribí tu correo institucional.',
  correo_no_institucional: `Usá tu correo institucional (@${EMAIL_DOMAIN}).`,
  correo_no_en_padron: 'Tu correo no aparece en la lista de la promoción. Escribile a tu representante.',
  carrera_requerida: 'Elegí tu carrera.',
  carrera_no_coincide: 'La carrera no coincide con la registrada para tu correo.',
  comentario_largo: `El comentario puede tener hasta ${MAX.comentario} caracteres.`,
  espera_unos_segundos: 'Ya recibimos tu voto. Esperá unos segundos antes de cambiarlo.',
  no_autorizado: 'Clave incorrecta. Revisala e intentá de nuevo.',
};

const GENERIC = 'No pudimos enviar tu voto. Intentá de nuevo.';

/** Traduce un código de error del backend (o del cliente) al mensaje de la UI (SPEC §7.3). */
export function errorMessage(code: string | undefined): string {
  if (!code) return GENERIC;
  if (code.startsWith('valor_invalido_')) return 'Algo salió mal con tu selección. Recargá la página.';
  return MESSAGES[code] ?? GENERIC;
}
