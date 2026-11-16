import './styles/tokens.css';
import './styles/base.css';
import './styles/vote.css';

import {
  CAREERS,
  FONDOS,
  FONTS,
  LOGOS,
  OPTIONS_VERSION,
  findCareer,
  findFondo,
  findFont,
  findLogo,
  isCareerId,
  isFondoId,
  isFontId,
  isLogoId,
  type CareerId,
  type FondoId,
  type FontId,
  type LogoId,
} from './config';
import { api } from './api';
import { $, h, setPressed } from './dom';
import { renderShirt, type Side } from './shirt';
import { readJSON, writeJSON } from './storage';
import { buildVoteData, errorMessage, validateVote, type Field, type VoteForm } from './validate';

/* ------------------------------------------------------------------ */
/* Estado                                                              */
/* ------------------------------------------------------------------ */

type View = 'single' | 'grid';
type Phase = 'form' | 'sending' | 'sent' | 'closed';

interface State {
  lens: CareerId;
  fondo: FondoId;
  logo: LogoId;
  fuente: FontId;
  side: Side;
  view: View;
  form: VoteForm;
  phase: Phase;
}

const STORE_KEY = `camiseta-promo-2027:voto:${OPTIONS_VERSION}`;

interface Saved {
  lens?: string;
  fondo?: string;
  logo?: string;
  fuente?: string;
  side?: string;
  view?: string;
  form?: Partial<VoteForm>;
}

function loadState(): State {
  const s = readJSON<Saved>(STORE_KEY) ?? {};
  const f = s.form ?? {};
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    lens: isCareerId(s.lens) ? s.lens : 'ISND',
    fondo: isFondoId(s.fondo) ? s.fondo : 'blanco',
    logo: isLogoId(s.logo) ? s.logo : 'siglas',
    fuente: isFontId(s.fuente) ? s.fuente : 'bebas',
    side: s.side === 'back' ? 'back' : 'front',
    view: s.view === 'grid' ? 'grid' : 'single',
    form: {
      nombre: str(f.nombre),
      correo: str(f.correo),
      carrera: isCareerId(f.carrera) ? f.carrera : '',
      comentario: str(f.comentario),
    },
    phase: 'form',
  };
}

const state = loadState();

function save(): void {
  const { lens, fondo, logo, fuente, side, view, form } = state;
  writeJSON(STORE_KEY, { lens, fondo, logo, fuente, side, view, form } satisfies Saved);
}

/* ------------------------------------------------------------------ */
/* Elementos                                                           */
/* ------------------------------------------------------------------ */

const el = {
  sides: $('#sides'),
  views: $('#views'),
  single: $('#single'),
  singleShirt: $('#single-shirt'),
  viewing: $('#viewing'),
  gridWrap: $('#grid-wrap'),
  grid: $('#grid'),
  careers: $('#opt-careers'),
  fondos: $('#opt-fondos'),
  logos: $('#opt-logos'),
  fonts: $('#opt-fonts'),
  resumen: $('#resumen'),
  form: $<HTMLFormElement>('#form'),
  nombre: $<HTMLInputElement>('#f-nombre'),
  correo: $<HTMLInputElement>('#f-correo'),
  carrera: $<HTMLSelectElement>('#f-carrera'),
  comentario: $<HTMLTextAreaElement>('#f-coment'),
  comentCount: $('#coment-count'),
  website: $<HTMLInputElement>('#f-website'),
  formError: $('#form-error'),
  submit: $<HTMLButtonElement>('#submit'),
  success: $('#success'),
  successTitle: $('#success-title'),
  change: $<HTMLButtonElement>('#change'),
  closed: $('#closed'),
  versionWarn: $('#version-warn'),
  preview: $('#preview'),
  vote: $('#voto'),
  mini: $<HTMLButtonElement>('#mini'),
  miniShirt: $('#mini-shirt'),
};

const fieldEls: Record<Exclude<Field, 'seleccion'>, { input: HTMLElement; error: HTMLElement }> = {
  nombre: { input: el.nombre, error: $('#e-nombre') },
  correo: { input: el.correo, error: $('#e-correo') },
  carrera: { input: el.carrera, error: $('#e-carrera') },
  comentario: { input: el.comentario, error: $('#e-coment') },
};

/* ------------------------------------------------------------------ */
/* Construcción de controles (una sola vez, desde config)              */
/* ------------------------------------------------------------------ */

const check = () => h('span', { class: 'opt__check', 'aria-hidden': 'true' });

const sideBtns = (
  [
    ['front', 'Frente'],
    ['back', 'Espalda'],
  ] as const
).map(([id, label]) => {
  const b = h('button', { type: 'button', class: 'seg__btn', onclick: () => set({ side: id }) }, label);
  el.sides.append(b);
  return { id, b };
});

const viewBtns = (
  [
    ['single', '1 carrera'],
    ['grid', 'Las 4 carreras'],
  ] as const
).map(([id, label]) => {
  const b = h('button', { type: 'button', class: 'seg__btn', onclick: () => set({ view: id }) }, label);
  el.views.append(b);
  return { id, b };
});

const careerBtns = CAREERS.map((c) => {
  const dot = h('span', { class: 'dot', 'aria-hidden': 'true' });
  dot.style.background = c.color;
  const b = h(
    'button',
    { type: 'button', class: 'opt opt--career', title: c.nombre, 'aria-label': `${c.id}: ${c.nombre}`, onclick: () => set({ lens: c.id }) },
    dot,
    c.id,
  );
  el.careers.append(b);
  return { id: c.id, b };
});

const fondoBtns = FONDOS.map((f) => {
  const sw = h('span', { class: 'swatch', 'aria-hidden': 'true' });
  const b = h('button', { type: 'button', class: 'opt opt--fondo', onclick: () => set({ fondo: f.id }) }, sw, f.label, check());
  el.fondos.append(b);
  return { id: f.id, b, sw };
});

const logoBtns = LOGOS.map((l) => {
  const b = h(
    'button',
    { type: 'button', class: 'opt opt--logo', onclick: () => set({ logo: l.id }) },
    h('span', { class: 'opt__title' }, l.label),
    h('span', { class: 'opt__desc' }, l.desc),
    check(),
  );
  el.logos.append(b);
  return { id: l.id, b };
});

const fontBtns = FONTS.map((t) => {
  const sample = h('span', { class: 'font-sample', 'aria-hidden': 'true' });
  sample.style.fontFamily = t.family;
  sample.style.fontWeight = String(t.weight);
  sample.style.letterSpacing = t.tracking;
  const b = h(
    'button',
    { type: 'button', class: 'opt opt--font', 'aria-label': `${t.nombre}, ${t.desc}`, onclick: () => set({ fuente: t.id }) },
    sample,
    h('span', { class: 'font-meta', 'aria-hidden': 'true' }, h('span', { class: 'font-meta__name' }, t.nombre), h('span', { class: 'opt__desc' }, t.desc)),
    check(),
  );
  el.fonts.append(b);
  return { id: t.id, b, sample };
});

for (const c of CAREERS) el.carrera.append(h('option', { value: c.id }, `${c.id} — ${c.nombre}`));

// Celdas de la vista "Las 4 carreras".
const gridCells = CAREERS.map((c) => {
  const shirt = h('div');
  el.grid.append(h('div', { class: 'grid-card' }, shirt, h('p', { class: 'grid-card__label', 'aria-hidden': 'true' }, c.id)));
  return { c, shirt };
});

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

function set(patch: Partial<State>): void {
  Object.assign(state, patch);
  save();
  render();
}

function render(): void {
  const lens = findCareer(state.lens)!;
  const font = findFont(state.fuente)!;
  const shirtProps = { fondo: state.fondo, logo: state.logo, font, side: state.side };

  for (const { id, b } of sideBtns) setPressed(b, state.side === id);
  for (const { id, b } of viewBtns) setPressed(b, state.view === id);
  for (const { id, b } of careerBtns) setPressed(b, state.lens === id);
  for (const { id, b, sw } of fondoBtns) {
    setPressed(b, state.fondo === id);
    const f = findFondo(id)!;
    sw.style.background = f.hex ?? lens.fondo;
  }
  for (const { id, b } of logoBtns) setPressed(b, state.logo === id);
  for (const { id, b, sample } of fontBtns) {
    setPressed(b, state.fuente === id);
    sample.textContent = `${lens.id} 2027`;
  }

  const single = state.view === 'single';
  el.single.hidden = !single;
  el.gridWrap.hidden = single;
  if (single) {
    renderShirt(el.singleShirt, { career: lens, ...shirtProps });
    el.viewing.textContent = lens.nombre;
  } else {
    for (const { c, shirt } of gridCells) renderShirt(shirt, { career: c, ...shirtProps });
  }
  renderShirt(el.miniShirt, { career: lens, ...shirtProps });

  el.resumen.textContent = `${findFondo(state.fondo)!.label} · ${findLogo(state.logo)!.label} · ${font.nombre}`;
  renderPhase();
}

function renderPhase(): void {
  const p = state.phase;
  el.form.hidden = p === 'sent' || p === 'closed';
  el.success.hidden = p !== 'sent';
  el.closed.hidden = p !== 'closed';
  const sending = p === 'sending';
  el.submit.disabled = sending;
  el.submit.setAttribute('aria-busy', sending ? 'true' : 'false');
  el.submit.replaceChildren(
    ...(sending ? [h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Enviando…'] : ['Enviar mi voto']),
  );
}

/* ------------------------------------------------------------------ */
/* Formulario                                                          */
/* ------------------------------------------------------------------ */

function fillForm(): void {
  el.nombre.value = state.form.nombre;
  el.correo.value = state.form.correo;
  el.carrera.value = state.form.carrera;
  el.comentario.value = state.form.comentario;
  el.comentCount.textContent = String(el.comentario.value.length);
}

function setFieldError(field: Exclude<Field, 'seleccion'>, msg: string): void {
  const { input, error } = fieldEls[field];
  error.textContent = msg;
  error.hidden = !msg;
  if (msg) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}

function clearErrors(): void {
  for (const k of Object.keys(fieldEls) as (keyof typeof fieldEls)[]) setFieldError(k, '');
  showFormError('');
}

function showFormError(msg: string): void {
  el.formError.textContent = msg;
  el.formError.hidden = !msg;
}

function bindField(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, key: keyof VoteForm): void {
  const handler = () => {
    state.form[key] = input.value;
    setFieldError(key, '');
    showFormError('');
    if (key === 'comentario') el.comentCount.textContent = String(input.value.length);
    if (key === 'carrera' && isCareerId(input.value)) {
      set({ lens: input.value }); // al elegir tu carrera, la vista previa cambia a esa carrera
      return;
    }
    save();
  };
  input.addEventListener('input', handler);
  input.addEventListener('change', handler);
}

bindField(el.nombre, 'nombre');
bindField(el.correo, 'correo');
bindField(el.carrera, 'carrera');
bindField(el.comentario, 'comentario');

// Normaliza el correo al salir del campo.
el.correo.addEventListener('blur', () => {
  const v = el.correo.value.trim().toLowerCase();
  if (v !== el.correo.value) {
    el.correo.value = v;
    state.form.correo = v;
    save();
  }
});

el.form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (state.phase === 'sending') return;
  clearErrors();

  const sel = { fondo: state.fondo, logo: state.logo, tipografia: state.fuente };
  const errors = validateVote(state.form, sel);
  if (errors.length) {
    let first: HTMLElement | null = null;
    for (const e of errors) {
      if (e.field === 'seleccion') showFormError(errorMessage(e.code));
      else {
        setFieldError(e.field, errorMessage(e.code));
        first ??= fieldEls[e.field].input;
      }
    }
    first?.focus();
    return;
  }

  const data = buildVoteData(state.form, sel, el.website.value);
  state.phase = 'sending';
  renderPhase();

  const res = await api.vote(data);

  if (res.ok) {
    state.phase = 'sent';
    el.successTitle.textContent = res.updated ? '¡Voto actualizado!' : `¡Voto registrado, ${data.nombre}!`;
    renderPhase();
    el.successTitle.focus({ preventScroll: true });
    el.vote.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  if (res.error === 'votacion_cerrada') {
    state.phase = 'closed';
    renderPhase();
    return;
  }

  state.phase = 'form';
  renderPhase();
  const msg = errorMessage(res.error);
  // Los errores del servidor que corresponden a un campo se muestran junto a él.
  const fieldFor: Record<string, Exclude<Field, 'seleccion'>> = {
    nombre_requerido: 'nombre',
    correo_no_institucional: 'correo',
    correo_no_en_padron: 'correo',
    carrera_no_coincide: 'carrera',
  };
  const field = res.error ? fieldFor[res.error] : undefined;
  if (field) setFieldError(field, msg);
  showFormError(msg);
});

el.change.addEventListener('click', () => {
  state.phase = 'form';
  renderPhase();
  el.preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.preview.focus({ preventScroll: true });
});

/* ------------------------------------------------------------------ */
/* Mini vista previa flotante (celular)                                */
/* ------------------------------------------------------------------ */

function setupMini(): void {
  if (!('IntersectionObserver' in window)) return;
  let previewVisible = true;
  let voteVisible = false;
  const update = () => el.mini.classList.toggle('is-visible', !previewVisible && !voteVisible);
  new IntersectionObserver(([e]) => {
    previewVisible = !!e?.isIntersecting;
    update();
  }, { threshold: 0.15 }).observe(el.preview);
  // Se oculta en cuanto el bloque de voto asoma por encima de la franja inferior donde vive la
  // mini vista previa, para que nunca tape campos ni botones del formulario.
  new IntersectionObserver(([e]) => {
    voteVisible = !!e?.isIntersecting;
    update();
  }, { rootMargin: '0px 0px -20% 0px' }).observe(el.vote);
  el.mini.addEventListener('click', () => {
    el.preview.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.preview.focus({ preventScroll: true });
  });
}

/* ------------------------------------------------------------------ */
/* Arranque                                                            */
/* ------------------------------------------------------------------ */

fillForm();
render();
setupMini();

api.status().then((r) => {
  if (!r.ok) return; // sin conexión: el formulario queda habilitado y el servidor decide al votar
  if (!r.open && state.phase !== 'sent') {
    state.phase = 'closed';
    renderPhase();
  }
  if (r.version && r.version !== OPTIONS_VERSION) el.versionWarn.hidden = false;
});
