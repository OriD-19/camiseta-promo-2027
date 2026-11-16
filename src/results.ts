import './styles/tokens.css';
import './styles/base.css';
import './styles/results.css';

import { CAREERS, findCareer, findFont, type CareerId } from './config';
import { api, type Comentario, type ResultsData } from './api';
import {
  baseFor,
  byCareer,
  cleanVotes,
  comboLabel,
  filterVotes,
  fmtPct,
  gapText,
  optionLabel,
  ratio,
  tally,
  toCSV,
  topCombos,
  winner,
  type Cleaned,
  type Filter,
  type VarKey,
} from './aggregate';
import { $, h, setPressed } from './dom';
import { renderShirt } from './shirt';
import { readJSON, remove, writeJSON } from './storage';

const KEY_STORE = 'camiseta-promo-2027:clave'; // sessionStorage: nunca en la URL

/* ------------------------------------------------------------------ */
/* Estado                                                              */
/* ------------------------------------------------------------------ */

interface State {
  key: string;
  data: ResultsData | null;
  clean: Cleaned | null;
  filter: Filter;
  lens: CareerId;
  search: string;
  loadedAt: Date | null;
  loading: boolean;
}

const state: State = {
  key: readJSON<string>(KEY_STORE, 'session') ?? '',
  data: null,
  clean: null,
  filter: 'todas',
  lens: 'ISND',
  search: '',
  loadedAt: null,
  loading: false,
};

const el = {
  login: $('#login'),
  loginForm: $<HTMLFormElement>('#login-form'),
  key: $<HTMLInputElement>('#f-key'),
  loginError: $('#login-error'),
  loginBtn: $<HTMLButtonElement>('#login-btn'),
  mockHint: $('#mock-hint'),
  dash: $('#dash'),
  mockBadge: $('#mock-badge'),
  openChip: $('#open-chip'),
  filters: $('#filters'),
  updated: $('#updated'),
  refresh: $<HTMLButtonElement>('#refresh'),
  csv: $<HTMLButtonElement>('#csv'),
  logout: $<HTMLButtonElement>('#logout'),
  dashError: $('#dash-error'),
  oldWarn: $('#old-warn'),
  summary: $('#summary'),
  lenses: $('#lenses'),
  top3: $('#top3'),
  vars: $('#vars'),
  careersBody: $('#careers-body'),
  search: $<HTMLInputElement>('#f-search'),
  comments: $('#comments'),
  commentsCount: $('#comments-count'),
};

const RESULTS_ERRORS: Record<string, string> = {
  no_autorizado: 'Clave incorrecta. Revisala e intentá de nuevo.',
};
const resultsError = (code?: string) =>
  (code && RESULTS_ERRORS[code]) || 'No pudimos cargar los resultados. Revisá tu conexión e intentá de nuevo.';

/* ------------------------------------------------------------------ */
/* Controles fijos                                                     */
/* ------------------------------------------------------------------ */

const filterBtns = (['todas', ...CAREERS.map((c) => c.id)] as Filter[]).map((id) => {
  const b = h(
    'button',
    { type: 'button', class: 'seg__btn', onclick: () => setFilter(id) },
    id === 'todas' ? 'Toda la promo' : id,
  );
  if (id !== 'todas') b.setAttribute('aria-label', findCareer(id)!.nombre);
  el.filters.append(b);
  return { id, b };
});

const lensBtns = CAREERS.map((c) => {
  const b = h(
    'button',
    {
      type: 'button',
      class: 'lens__btn',
      'aria-label': `Ver camisetas como ${c.id}`,
      onclick: () => {
        state.lens = c.id;
        // Si hay una carrera filtrada, la vista previa siempre es esa: cambiar el lente cambia el filtro.
        if (state.filter !== 'todas') state.filter = c.id;
        render();
      },
    },
    c.id,
  );
  el.lenses.append(b);
  return { id: c.id, b };
});

function setFilter(f: Filter): void {
  state.filter = f;
  if (f !== 'todas') state.lens = f;
  render();
}

/* ------------------------------------------------------------------ */
/* Carga                                                               */
/* ------------------------------------------------------------------ */

function showLogin(msg = ''): void {
  el.dash.hidden = true;
  el.login.hidden = false;
  el.loginError.textContent = msg;
  el.loginError.hidden = !msg;
  el.mockHint.hidden = !api.isMock;
  el.key.value = '';
  el.key.focus();
}

function setLoading(on: boolean): void {
  state.loading = on;
  el.loginBtn.disabled = on;
  el.loginBtn.replaceChildren(...(on ? [h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Cargando…'] : ['Ver resultados']));
  el.refresh.disabled = on;
  el.refresh.replaceChildren(...(on ? [h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Actualizando…'] : ['Actualizar']));
}

async function load(key: string, fromLogin: boolean): Promise<void> {
  if (state.loading) return;
  setLoading(true);
  const r = await api.results(key);
  setLoading(false);

  if (!r.ok) {
    if (r.error === 'no_autorizado') {
      remove(KEY_STORE, 'session');
      state.key = '';
      showLogin(resultsError(r.error));
      return;
    }
    if (fromLogin || !state.data) {
      showLogin(resultsError(r.error));
      return;
    }
    el.dashError.textContent = resultsError(r.error);
    el.dashError.hidden = false;
    return;
  }

  state.key = key;
  writeJSON(KEY_STORE, key, 'session');
  state.data = r;
  state.clean = cleanVotes(r.votes);
  state.loadedAt = new Date();
  el.dashError.hidden = true;
  const wasHidden = el.dash.hidden;
  el.login.hidden = true;
  el.dash.hidden = false;
  render();
  if (wasHidden) window.scrollTo({ top: 0 });
}

el.loginForm.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const key = el.key.value.trim();
  if (!key) {
    el.loginError.textContent = 'Escribí la clave.';
    el.loginError.hidden = false;
    el.key.focus();
    return;
  }
  el.loginError.hidden = true;
  void load(key, true);
});

el.refresh.addEventListener('click', () => void load(state.key, false));

el.logout.addEventListener('click', () => {
  remove(KEY_STORE, 'session');
  state.key = '';
  state.data = null;
  state.clean = null;
  showLogin();
});

el.csv.addEventListener('click', () => {
  if (!state.clean) return;
  // BOM para que Excel abra el UTF-8 correctamente.
  const blob = new Blob(['﻿' + toCSV(state.clean.votes)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: `camiseta-promo-2027-votos-anonimo-${stamp()}.csv` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

el.search.addEventListener('input', () => {
  state.search = el.search.value;
  renderComments();
});

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

const dot = (color: string) => {
  const d = h('span', { class: 'dot', 'aria-hidden': 'true' });
  d.style.background = color;
  return d;
};

const VAR_TITLES: Record<VarKey, { card: string; panel: string }> = {
  fondo: { card: 'Fondo más votado', panel: 'Color de fondo' },
  logo: { card: 'Logo más votado', panel: 'Logo frontal' },
  tipografia: { card: 'Tipografía más votada', panel: 'Tipografía' },
};
const VARS: VarKey[] = ['fondo', 'logo', 'tipografia'];

function render(): void {
  const data = state.data;
  const clean = state.clean;
  if (!data || !clean) return;

  const lensId: CareerId = state.filter === 'todas' ? state.lens : state.filter;
  for (const { id, b } of filterBtns) setPressed(b, state.filter === id);
  for (const { id, b } of lensBtns) setPressed(b, lensId === id);

  el.mockBadge.hidden = !api.isMock;
  el.openChip.textContent = data.open ? 'Votación abierta' : 'Votación cerrada';
  el.openChip.className = `chip ${data.open ? 'chip--open' : 'chip--closed'}`;
  el.updated.textContent = state.loadedAt
    ? `Última carga: ${state.loadedAt.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
    : '';

  const excluded = clean.oldVersion + clean.invalid;
  el.oldWarn.hidden = excluded === 0;
  if (excluded) {
    const parts: string[] = [];
    if (clean.oldVersion) parts.push(`${clean.oldVersion} ${clean.oldVersion === 1 ? 'voto' : 'votos'} de una versión anterior de las opciones`);
    if (clean.invalid) parts.push(`${clean.invalid} con opciones desconocidas`);
    el.oldWarn.textContent = `Hay ${parts.join(' y ')}. No se cuentan en ningún resultado ni en el CSV.`;
  }

  const rows = filterVotes(clean.votes, state.filter);
  const total = rows.length;
  const base = baseFor(data.inscritos, state.filter);
  const tallies = Object.fromEntries(VARS.map((k) => [k, tally(rows, k)])) as Record<VarKey, ReturnType<typeof tally>>;

  /* --- Resumen --- */
  const partW = Math.min(100, Math.round(ratio(total, base) * 100));
  const fill = h('div', { class: 'track__fill' });
  fill.style.width = `${partW}%`;
  const summary: HTMLElement[] = [
    h(
      'div',
      { class: 'card card--wide' },
      h('p', { class: 'card__label' }, 'Votos recibidos'),
      h('p', { class: 'card__big' }, total),
      h('p', { class: 'card__meta' }, base ? `de ${base} personas · ${fmtPct(total, base)} de participación` : 'Sin datos de inscritos'),
      h('div', { class: 'track', role: 'img', 'aria-label': `Participación: ${base ? fmtPct(total, base) : 'sin datos'}` }, fill),
    ),
  ];
  for (const k of VARS) {
    const w = winner(tallies[k]);
    summary.push(
      h(
        'div',
        { class: 'card' },
        h('p', { class: 'card__label' }, VAR_TITLES[k].card),
        h('p', { class: 'card__value' }, w ? w.label : '—'),
        h('p', { class: 'card__meta' }, w ? `${w.count} ${w.count === 1 ? 'voto' : 'votos'} · ${fmtPct(w.count, total)} · ${gapText(w)}` : 'Sin votos todavía'),
      ),
    );
  }
  el.summary.replaceChildren(...summary);

  /* --- Top 3 --- */
  const lens = findCareer(lensId)!;
  const top = topCombos(rows, 3);
  if (!top.length) {
    el.top3.replaceChildren(h('p', { class: 'empty' }, 'Todavía no hay votos para mostrar combinaciones.'));
  } else {
    el.top3.replaceChildren(
      ...top.map((c, i) => {
        const shirt = h('div');
        renderShirt(shirt, { career: lens, fondo: c.fondo, logo: c.logo, font: findFont(c.tipografia)!, side: 'front' });
        return h(
          'article',
          { class: `combo${i === 0 ? ' combo--first' : ''}`, 'aria-label': `Puesto ${i + 1}: ${comboLabel(c)}` },
          h(
            'div',
            { class: 'combo__head' },
            h('span', { class: 'combo__rank' }, `#${i + 1}`),
            h('span', { class: 'combo__count' }, `${c.count} ${c.count === 1 ? 'voto' : 'votos'} · ${fmtPct(c.count, total)}`),
          ),
          shirt,
          h(
            'dl',
            { class: 'combo__dl' },
            h('dt', {}, 'Fondo'),
            h('dd', {}, optionLabel('fondo', c.fondo)),
            h('dt', {}, 'Logo'),
            h('dd', {}, optionLabel('logo', c.logo)),
            h('dt', {}, 'Tipografía'),
            h('dd', {}, optionLabel('tipografia', c.tipografia)),
          ),
        );
      }),
    );
  }

  /* --- Barras por variable --- */
  el.vars.replaceChildren(
    ...VARS.map((k) => {
      const t = tallies[k];
      const w = winner(t);
      const max = Math.max(1, ...t.map((o) => o.count));
      return h(
        'div',
        { class: 'panel' },
        h(
          'div',
          { class: 'panel__head' },
          h('h3', { class: 'h3' }, VAR_TITLES[k].panel),
          h('p', { class: 'muted small-2' }, ...(w ? ['Gana ', h('strong', {}, w.label), ` con ${fmtPct(w.count, total)}`] : ['Sin votos todavía'])),
        ),
        h(
          'ul',
          { class: 'bars' },
          ...t.map((o) => {
            const isTop = !!w && o.id === w.id;
            const f = h('div', { class: 'track__fill' });
            f.style.width = `${Math.round((o.count / max) * 100)}%`;
            return h(
              'li',
              { class: `bar${isTop ? ' bar--top' : ''}` },
              h(
                'div',
                { class: 'bar__row' },
                h('span', { class: 'bar__label' }, o.label),
                h('span', { class: 'bar__num' }, `${o.count} · ${fmtPct(o.count, total)}`),
              ),
              h('div', { class: 'track', 'aria-hidden': 'true' }, f),
            );
          }),
        ),
      );
    }),
  );

  /* --- Desglose por carrera (siempre toda la promo) --- */
  el.careersBody.replaceChildren(
    ...byCareer(clean.votes, data.inscritos).map((r) => {
      const c = findCareer(r.id)!;
      return h(
        'tr',
        {},
        h('th', { scope: 'row' }, h('span', { class: 'career-tag' }, dot(c.color), r.id)),
        h('td', { class: 'num' }, r.inscritos ? `${r.votos}/${r.inscritos} · ${fmtPct(r.votos, r.inscritos)}` : `${r.votos}`),
        h('td', {}, r.fondo ?? '—'),
        h('td', {}, r.logo ?? '—'),
        h('td', {}, r.tipografia ?? '—'),
        h('td', {}, r.combo ? `${comboLabel(r.combo)} (${r.combo.count})` : '—'),
      );
    }),
  );

  renderComments();
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function renderComments(): void {
  const data = state.data;
  if (!data) return;
  const all: Comentario[] = data.comentarios.filter((c) => state.filter === 'todas' || c.carrera === state.filter);
  const q = normalize(state.search.trim());
  const list = q ? all.filter((c) => normalize(`${c.texto} ${c.carrera}`).includes(q)) : all;

  el.commentsCount.textContent = q
    ? `${list.length} de ${all.length} ${all.length === 1 ? 'comentario' : 'comentarios'}`
    : `${all.length} ${all.length === 1 ? 'comentario' : 'comentarios'}`;

  if (!list.length) {
    el.comments.replaceChildren(h('li', { class: 'empty' }, q ? 'Ningún comentario coincide con la búsqueda.' : 'Todavía no hay comentarios.'));
    return;
  }
  el.comments.replaceChildren(
    ...list.map((c) => {
      const career = findCareer(c.carrera);
      return h(
        'li',
        { class: 'comment' },
        h('span', { class: 'comment__career' }, career ? dot(career.color) : null, c.carrera || '—'),
        h('p', { class: 'comment__text' }, c.texto),
      );
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Arranque                                                            */
/* ------------------------------------------------------------------ */

if (state.key) void load(state.key, true);
else showLogin();
