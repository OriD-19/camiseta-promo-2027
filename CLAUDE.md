# CLAUDE.md — Camiseta Promo 2027

Sitio estático para que la promoción 2027 de la ESEN (unas 125 personas, carreras LEN, LCJ, IDN e ISND) vote el frente común de su camiseta. Incluye un dashboard de resultados para los representantes. El backend es Google Apps Script + Google Sheets.

**Lee primero `docs/SPEC.md`**: ahí están el alcance, el contrato con el backend y los criterios de aceptación. El diseño de referencia está en `reference/prototipo/`; ver `reference/prototipo/README.md`.

## Estructura

```
index.html                 votación
resultados.html            dashboard (protegido con clave)
src/
  config.ts                ÚNICA fuente de verdad de opciones, colores y posición del logo
  colors.ts                luminancia, contraste, mezcla y shirtColors() (puro, con tests)
  shirt.ts                 renderShirt(): SVG + capa de logo
  api.ts                   cliente del Apps Script (status, vote, results)
  aggregate.ts             conteos, top 3 y desglose por carrera (puro, con tests)
  vote.ts                  lógica de la página de votación
  results.ts               lógica del dashboard
  styles/                  tokens.css, base.css, vote.css, results.css
tests/                     Vitest
apps-script/               Code.gs + appsscript.json (se pegan en Apps Script, no se compilan)
docs/                      SPEC.md, APPS_SCRIPT.md
reference/prototipo/       prototipo de diseño (.dc.html); solo es referencia, no se sirve
.github/workflows/deploy.yml
```

## Comandos

- `npm run dev`: servidor local.
- `npm run build`: build de producción (multi-página: `index.html` + `resultados.html`).
- `npm test`: Vitest.
- `npm run typecheck`: `tsc --noEmit`.

## Reglas del proyecto

- **Sin frameworks de UI ni Tailwind.** TypeScript plano + DOM + CSS con variables. Dependencias mínimas: vite, typescript, vitest.
- **Opciones solo en `src/config.ts`.** Si cambian ids, actualizar también `ALLOWED` en `apps-script/Code.gs` y subir `OPTIONS_VERSION` en ambos.
- **Llamadas al backend:** `Content-Type: text/plain;charset=utf-8` con body JSON. Nunca `application/json`, porque dispara un preflight CORS que Apps Script no soporta.
- **El dashboard nunca muestra datos personales.** La clave de admin va en el body y se guarda en `sessionStorage`, nunca en la URL.
- **Textos de la UI** en español salvadoreño con voseo (Elegí, Enviá, Usá), copiados del prototipo cuando existan.
- **Accesibilidad:**
  - Botones reales con `aria-pressed` para las selecciones.
  - `<label>` en cada campo.
  - Foco visible.
  - Contraste ≥ 4.5:1.
  - Áreas táctiles ≥ 44 px.
- **Mobile first.**
- **Colores de la camiseta:** siempre vía `shirtColors()`; no hardcodear colores en los componentes.
- **Lógica pura** (colores, validación, agregación) separada del DOM y cubierta por tests.
- **Seguridad:** no tocar `apps-script/Code.gs` salvo que la tarea lo pida. Si cambia el contrato, actualizar `docs/SPEC.md` §7 en el mismo cambio.

## Entorno

- `.env` (no se commitea):
  - `VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec`
  - `VITE_BASE=/` (con dominio propio) o `/<nombre-del-repo>/` (GitHub Pages sin dominio).
- En GitHub Actions, las dos se leen de *Repository variables* (`vars.VITE_APPS_SCRIPT_URL`, `vars.VITE_BASE`).
- Para desarrollar sin backend, `api.ts` puede usar un mock si `VITE_APPS_SCRIPT_URL` está vacío. El mock genera datos de ejemplo deterministas, como en el prototipo.
