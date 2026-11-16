/**
 * Camiseta Promo 2027 — Backend de votación (Google Apps Script + Google Sheets)
 *
 * Endpoints (todos por POST, body JSON enviado como text/plain para evitar preflight CORS):
 *   { "action": "status" }                         -> { ok, open, version }
 *   { "action": "vote", "data": { ... } }          -> { ok, updated }   | { ok:false, error }
 *   { "action": "results", "key": "ADMIN_KEY" }    -> { ok, votes:[...], inscritos:{...}, comentarios:[...] }
 * GET (sin parámetros) devuelve el mismo resultado que "status" (útil para probar en el navegador).
 *
 * Script Properties (Configuración del proyecto > Propiedades del script):
 *   ADMIN_KEY        clave para leer resultados desde el dashboard (obligatoria)
 *   VOTING_OPEN      "true" | "false"
 *   PADRON_REQUIRED  "true" para aceptar solo correos que estén en la hoja Padron
 *   INSCRITOS_JSON   opcional, p. ej. {"LEN":38,"LCJ":27,"IDN":30,"ISND":30} si no usan Padron
 */

const OPTIONS_VERSION = 'v1';

const SHEETS = { VOTOS: 'Votos', LOG: 'Log', PADRON: 'Padron' };

const VOTOS_HEADERS = ['timestamp', 'nombre', 'correo', 'carrera', 'fondo', 'logo', 'tipografia', 'comentario', 'version_opciones', 'envios'];
const LOG_HEADERS = ['timestamp', 'correo', 'carrera', 'fondo', 'logo', 'tipografia', 'version_opciones'];
const PADRON_HEADERS = ['correo', 'nombre', 'carrera'];

// Debe coincidir con los ids de src/config.ts en el frontend.
const ALLOWED = {
  carrera: ['LEN', 'LCJ', 'IDN', 'ISND'],
  fondo: ['blanco', 'negro', 'beige', 'carrera'],
  logo: ['siglas', 'linea', 'frase', 'insignia'],
  tipografia: ['bebas', 'montserrat', 'graduate', 'playfair', 'mono'],
};

const EMAIL_RE = /^[a-z0-9._%+-]+@esen\.edu\.sv$/;
const MAX = { nombre: 80, comentario: 500 };
const THROTTLE_SECONDS = 10;

/* ------------------------------------------------------------------ */
/* Entradas                                                            */
/* ------------------------------------------------------------------ */

function doGet() {
  return json_({ ok: true, open: isOpen_(), version: OPTIONS_VERSION });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'json_invalido' });
  }
  try {
    switch (body.action) {
      case 'status':
        return json_({ ok: true, open: isOpen_(), version: OPTIONS_VERSION });
      case 'vote':
        return json_(handleVote_(body.data || {}));
      case 'results':
        return json_(handleResults_(body.key));
      default:
        return json_({ ok: false, error: 'accion_invalida' });
    }
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, error: 'error_interno' });
  }
}

/* ------------------------------------------------------------------ */
/* Votar                                                               */
/* ------------------------------------------------------------------ */

function handleVote_(d) {
  if (!isOpen_()) return { ok: false, error: 'votacion_cerrada' };

  // Honeypot: campo oculto que una persona nunca llena.
  if (d.website) return { ok: true, updated: false };

  const v = {
    nombre: clean_(d.nombre, MAX.nombre),
    correo: String(d.correo || '').trim().toLowerCase(),
    carrera: String(d.carrera || '').trim(),
    fondo: String(d.fondo || '').trim(),
    logo: String(d.logo || '').trim(),
    tipografia: String(d.tipografia || '').trim(),
    comentario: clean_(d.comentario, MAX.comentario),
  };

  if (!v.nombre) return { ok: false, error: 'nombre_requerido' };
  if (!EMAIL_RE.test(v.correo)) return { ok: false, error: 'correo_no_institucional' };
  for (const k of Object.keys(ALLOWED)) {
    if (ALLOWED[k].indexOf(v[k]) === -1) return { ok: false, error: 'valor_invalido_' + k };
  }

  if (prop_('PADRON_REQUIRED') === 'true') {
    const p = padronLookup_(v.correo);
    if (!p) return { ok: false, error: 'correo_no_en_padron' };
    if (p.carrera && p.carrera !== v.carrera) return { ok: false, error: 'carrera_no_coincide' };
  }

  // Anti doble clic / abuso: un envío por correo cada THROTTLE_SECONDS.
  const cache = CacheService.getScriptCache();
  const ck = 'vote:' + v.correo;
  if (cache.get(ck)) return { ok: false, error: 'espera_unos_segundos' };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'servidor_ocupado' };
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const votos = ss.getSheetByName(SHEETS.VOTOS);
    const log = ss.getSheetByName(SHEETS.LOG);
    const now = new Date();

    const row = findRowByEmail_(votos, v.correo);
    let envios = 1;
    if (row) envios = Number(votos.getRange(row, VOTOS_HEADERS.indexOf('envios') + 1).getValue() || 0) + 1;

    const values = [[
      now, safe_(v.nombre), v.correo, v.carrera, v.fondo, v.logo, v.tipografia,
      safe_(v.comentario), OPTIONS_VERSION, envios,
    ]];

    if (row) votos.getRange(row, 1, 1, VOTOS_HEADERS.length).setValues(values);
    else votos.appendRow(values[0]);

    log.appendRow([now, v.correo, v.carrera, v.fondo, v.logo, v.tipografia, OPTIONS_VERSION]);
    cache.put(ck, '1', THROTTLE_SECONDS);

    return { ok: true, updated: !!row };
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Resultados (solo representantes)                                    */
/* ------------------------------------------------------------------ */

function handleResults_(key) {
  const adminKey = prop_('ADMIN_KEY');
  if (!adminKey || !key || String(key) !== adminKey) return { ok: false, error: 'no_autorizado' };

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.VOTOS);
  const last = sh.getLastRow();
  const rows = last > 1 ? sh.getRange(2, 1, last - 1, VOTOS_HEADERS.length).getValues() : [];
  const idx = (h) => VOTOS_HEADERS.indexOf(h);

  // Sin datos personales: el dashboard no necesita nombres ni correos.
  const votes = rows.map((r) => ({
    carrera: r[idx('carrera')],
    fondo: r[idx('fondo')],
    logo: r[idx('logo')],
    tipografia: r[idx('tipografia')],
    version: r[idx('version_opciones')],
  }));

  const comentarios = rows
    .filter((r) => String(r[idx('comentario')] || '').trim())
    .map((r) => ({ carrera: r[idx('carrera')], texto: String(r[idx('comentario')]).replace(/^'/, '') }));

  return { ok: true, version: OPTIONS_VERSION, open: isOpen_(), votes, inscritos: inscritos_(), comentarios };
}

/* ------------------------------------------------------------------ */
/* Setup: ejecutar UNA vez desde el editor                             */
/* ------------------------------------------------------------------ */

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEETS.VOTOS, VOTOS_HEADERS);
  ensureSheet_(ss, SHEETS.LOG, LOG_HEADERS);
  ensureSheet_(ss, SHEETS.PADRON, PADRON_HEADERS);

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('VOTING_OPEN')) props.setProperty('VOTING_OPEN', 'false');
  if (!props.getProperty('PADRON_REQUIRED')) props.setProperty('PADRON_REQUIRED', 'false');
  if (!props.getProperty('ADMIN_KEY')) props.setProperty('ADMIN_KEY', Utilities.getUuid());

  console.log('Listo. ADMIN_KEY = ' + props.getProperty('ADMIN_KEY'));
}

function abrirVotacion() { PropertiesService.getScriptProperties().setProperty('VOTING_OPEN', 'true'); }
function cerrarVotacion() { PropertiesService.getScriptProperties().setProperty('VOTING_OPEN', 'false'); }

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }

function isOpen_() { return prop_('VOTING_OPEN') === 'true'; }

function clean_(s, max) {
  return String(s || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Evita inyección de fórmulas al abrir el CSV/Excel (=, +, -, @ al inicio).
function safe_(s) { return /^[=+\-@]/.test(s) ? "'" + s : s; }

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function findRowByEmail_(sh, correo) {
  const last = sh.getLastRow();
  if (last < 2) return null;
  const col = VOTOS_HEADERS.indexOf('correo') + 1;
  const hit = sh.getRange(2, col, last - 1, 1).createTextFinder(correo).matchEntireCell(true).matchCase(false).findNext();
  return hit ? hit.getRow() : null;
}

function padronLookup_(correo) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.PADRON);
  if (!sh || sh.getLastRow() < 2) return null;
  const data = sh.getRange(2, 1, sh.getLastRow() - 1, PADRON_HEADERS.length).getValues();
  for (const r of data) {
    if (String(r[0]).trim().toLowerCase() === correo) return { correo, nombre: r[1], carrera: String(r[2] || '').trim() };
  }
  return null;
}

function inscritos_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.PADRON);
  const out = {};
  ALLOWED.carrera.forEach((c) => (out[c] = 0));
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 3, sh.getLastRow() - 1, 1).getValues().forEach((r) => {
      const c = String(r[0] || '').trim();
      if (c in out) out[c]++;
    });
    if (Object.keys(out).some((c) => out[c] > 0)) return out;
  }
  try {
    return JSON.parse(prop_('INSCRITOS_JSON') || 'null') || out;
  } catch (e) {
    return out;
  }
}
