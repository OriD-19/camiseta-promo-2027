# Especificación — Visualizador y votación de la camiseta Promo 2027 (ESEN)

## 1. Objetivo

Unas 125 personas de 4 carreras votan por **un solo frente común** para la camiseta de la promoción. El frente se define con tres variables: fondo, logo y tipografía. La espalda la diseña cada carrera por su cuenta, siguiendo la misma línea gráfica. Los representantes revisan los resultados en un dashboard protegido.

La referencia visual y de comportamiento es el prototipo de `reference/prototipo/`, que está escrito en un formato propio (`.dc.html`). **Hay que portar el diseño y la lógica, no la sintaxis**: `{{ }}`, `<sc-for>`, `<sc-if>`, `<dc-import>` y `DCLogic` no existen fuera del prototipo.

## 2. Stack y despliegue

- **Frontend:** Vite + TypeScript, sin framework de UI. Es un sitio estático multi-página:
  - `index.html`: votación.
  - `resultados.html`: dashboard.
- **Estilos:** CSS plano en `src/styles/`, con variables CSS para los tokens. No usar Tailwind.
- **Fuentes:** Google Fonts. UI en Inter y Space Grotesk; para el logo, Bebas Neue, Montserrat 800, Graduate, Playfair Display 800 y Space Mono 700.
- **Backend:** Google Apps Script + Google Sheets (`apps-script/`, guía en `docs/APPS_SCRIPT.md`). El frontend nunca habla directo con Sheets.
- **Hosting:** GitHub Pages, desplegado con GitHub Actions (`.github/workflows/deploy.yml`) en cada push a `main`.
  - `base` en `vite.config.ts` se lee de `VITE_BASE`: `/` con dominio propio, `/<repo>/` sin él.
  - Si hay dominio propio, `public/CNAME` contiene el subdominio.
- **Variables de entorno:**
  - `VITE_APPS_SCRIPT_URL`: URL `/exec` del backend.
  - `VITE_BASE`: ruta base del sitio.
  - Se documentan en `.env.example`.
- **Tests:** Vitest para la lógica pura: validación, agregación, colores y contraste.

## 3. Configuración única: `src/config.ts`

Es la única fuente de verdad de las opciones. Los ids deben coincidir con `ALLOWED` en `apps-script/Code.gs`.

```ts
export const OPTIONS_VERSION = 'v1';

export const CAREERS = [
  { id: 'LEN',  nombre: 'Licenciatura en Economía y Negocios',          color: '#EE803C', fondo: '#593924' },
  { id: 'LCJ',  nombre: 'Licenciatura en Ciencias Jurídicas',            color: '#D61A28', fondo: '#521C1F' },
  { id: 'IDN',  nombre: 'Ingeniería de Negocios',                        color: '#2BAC6E', fondo: '#224532' },
  { id: 'ISND', nombre: 'Ingeniería de Software y Negocios Digitales',   color: '#00AFAC', fondo: '#164644' },
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
export const LOGO_POSITION = { left: 56, top: 21, width: 24 };

export const EMAIL_DOMAIN = 'esen.edu.sv';
```

Para agregar una opción se toca este archivo y `ALLOWED` en `Code.gs`, y se sube `OPTIONS_VERSION` en ambos.

## 4. Componente camiseta: `src/shirt.ts`

`renderShirt(container, props)` dibuja la camiseta. Props: `career`, `fondo`, `logo`, `font`, `side: 'front' | 'back'`.

- **Silueta:** SVG `viewBox="0 0 400 390"`, corte boxy. Las rutas exactas (cuerpo, cuello frontal y trasero, costuras de manga) están en `reference/prototipo/Shirt.dc.html`; copiarlas tal cual.
- **Contenedor:** `aspect-ratio: 400 / 390` y `container-type: inline-size`. Todo el texto del logo se dimensiona en `cqw`, así se ve igual en la vista grande y en las miniaturas.
- **Logo:** capa HTML en posición absoluta sobre el SVG, en el pecho, según `LOGO_POSITION`. Hay 4 variantes con las proporciones del prototipo.
- **Espalda:** "SIGLA 2027" en la nuca y un recuadro punteado con "Diseño propio de {SIGLA} — Referencias de cada carrera, misma línea gráfica del frente".
- **Reglas de color** (función pura `shirtColors(career, fondo)` en `src/colors.ts`, con tests):
  - `fill`:
    - blanco → `#FFFFFF`
    - negro → `#151515`
    - beige → `#E6DAC3`
    - carrera → `career.fondo`
  - `dark` = luminancia relativa de `fill` < 0.3.
  - `ink` = `#F4F1EA` si `dark`; si no, `#161616`.
  - `accent` = `career.color`, salvo si `dark` y el contraste WCAG entre `career.color` y `fill` es < 3: entonces se mezcla 40 % hacia blanco. En la práctica esto solo pasa con el rojo LCJ sobre su fondo vino.
  - `stroke` = `#00000066` si `dark`; si no, `#0000002E`.
- **Accesibilidad:** el SVG lleva `role="img"` y un `aria-label` del estilo "Camiseta ISND, frente".

## 5. Página de votación (`index.html`)

Layout, textos y orden como en `reference/prototipo/Main.dc.html`.

1. **Encabezado:** "ESEN · Promoción 2027", el H1 "Elegí el frente de nuestra camiseta" y el texto sobre frente común y espalda por carrera.
2. **Vista previa:**
   - Toggle Frente/Espalda.
   - Toggle "1 carrera" / "Las 4 carreras". La vista de 4 carreras es una cuadrícula 2×2 con el mismo frente aplicado a cada una.
   - Debajo, "Viendo como {carrera}".
3. **Controles** (botones con `aria-pressed`, nunca divs clicables):
   - "Ver como": 4 carreras. Es solo un lente de vista previa y no se vota.
   - "1 · Color de fondo": 4 opciones con muestra de color. La muestra de "Color de la carrera" usa el fondo de la carrera que se está viendo.
   - "2 · Logo frontal": 4 opciones.
   - "3 · Tipografía": 5 opciones. Cada una muestra "{SIGLA} 2027" en su propia fuente.
4. **Formulario "Enviá tu voto":**
   - Resumen de la combinación elegida.
   - Campos:
     - Nombre completo (requerido, máx. 80).
     - Correo institucional (requerido, debe terminar en `@esen.edu.sv`, se normaliza a minúsculas).
     - Tu carrera (select requerido). Al elegirla, el lente "Ver como" cambia a esa carrera.
     - Comentario o propuesta de frase (opcional, máx. 500).
   - Honeypot `website`: input oculto con `tabindex="-1"` y `autocomplete="off"`, fuera de la vista con CSS.
   - Botón "Enviar mi voto": se deshabilita mientras envía y muestra un estado de carga.
   - Nota: "Si votás más de una vez, cuenta solo tu último voto."
5. **Estados:**
   - Éxito: "¡Voto registrado, {nombre}!", o "¡Voto actualizado!" si `updated`. Incluye el botón "Cambiar mi voto".
   - Error: mensaje en `role="alert"` (ver tabla 7.3).
   - Votación cerrada: al cargar se llama a `status`. Si está cerrada, el visualizador sigue usable y el formulario muestra "La votación está cerrada".
6. **Persistencia ligera:** guardar la selección y el formulario en `localStorage` (envuelto en try/catch), para no perder nada si se recarga la página.
7. **Mobile first:** a menos de 860 px, vista previa arriba y controles abajo, a una columna. La mayoría va a votar desde el celular.

## 6. Dashboard (`resultados.html`)

Referencia: `reference/prototipo/Resultados.dc.html`.

- **Acceso:** pantalla inicial que pide la clave de representantes. Se manda en el body (`action: 'results'`), nunca en la URL, y se guarda en `sessionStorage`. Con `no_autorizado`, se muestra error y se vuelve a pedir.
- **Datos:** `{ votes, inscritos, comentarios }` del backend. Toda la agregación se hace en el cliente, en `src/aggregate.ts` (funciones puras con tests).
- **Filtro global:** "Toda la promo" / LEN / LCJ / IDN / ISND. Recalcula todo.
- **Tarjetas resumen:**
  - Votos recibidos, "de N personas", % de participación y una barra.
  - Una tarjeta por variable (fondo, logo, tipografía) con el ganador, sus votos, su % y la ventaja sobre el segundo ("+N sobre X" o "empate").
- **Top 3 combinaciones** (fondo + logo + tipografía como una unidad):
  - Tarjetas con rango, votos, % y una camiseta renderizada con `renderShirt`.
  - Selector "Ver como" para elegir la carrera de la vista previa; si el filtro es una carrera, se usa esa.
  - El #1 lleva un borde destacado.
  - Empates: ordenar por votos y, a igualdad, por el orden de `config`.
- **Barras por variable:** todas las opciones ordenadas de mayor a menor, con conteo y %; la ganadora resaltada.
- **Desglose por carrera:** tabla con participación (votos / inscritos y %), fondo, logo y tipografía más votados, y la combinación #1 con su conteo. Si la tabla no cabe, scroll horizontal dentro de una caja.
- **Comentarios / frases propuestas:** lista simple con la carrera de cada comentario y un buscador.
- **Exportar:** botón "Descargar CSV (anónimo)" con las columnas `carrera,fondo,logo,tipografia,version`. El archivo completo, con nombres, se baja desde Google Sheets.
- **Actualizar:** botón "Actualizar" que vuelve a pedir los datos y muestra la hora de la última carga.
- **Versiones viejas:** los votos con `version` distinta de `OPTIONS_VERSION` se excluyen de todo (conteos, top 3, desglose y CSV). Si hay alguno, se muestra un aviso con cuántos son.

## 7. Contrato con el backend

### 7.1 Transporte

```ts
fetch(import.meta.env.VITE_APPS_SCRIPT_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // NO application/json: evita el preflight CORS
  body: JSON.stringify(payload),
  redirect: 'follow',
});
```

- La respuesta siempre es JSON: `{ ok: boolean, error?: string, ... }`.
- Timeout de 15 s con `AbortController`.
- Un reintento automático solo para fallas de red. **Nunca** se reintenta un error de negocio.

### 7.2 Acciones

| Acción | Payload | Respuesta ok |
|---|---|---|
| `status` | `{action}` | `{ok, open, version}` |
| `vote` | `{action, data:{nombre, correo, carrera, fondo, logo, tipografia, comentario, website}}` | `{ok, updated}` |
| `results` | `{action, key}` | `{ok, version, open, votes:[{carrera,fondo,logo,tipografia,version}], inscritos:{LEN,LCJ,IDN,ISND}, comentarios:[{carrera,texto}]}` |

### 7.3 Errores → mensajes en la UI

| `error` | Mensaje |
|---|---|
| `votacion_cerrada` | La votación está cerrada. |
| `nombre_requerido` | Escribí tu nombre. |
| `correo_no_institucional` | Usá tu correo institucional (@esen.edu.sv). |
| `correo_no_en_padron` | Tu correo no aparece en la lista de la promoción. Escribile a tu representante. |
| `carrera_no_coincide` | La carrera no coincide con la registrada para tu correo. |
| `valor_invalido_*` | Algo salió mal con tu selección. Recargá la página. |
| `espera_unos_segundos` | Ya recibimos tu voto. Esperá unos segundos antes de cambiarlo. |
| `servidor_ocupado` / `error_interno` / red | No pudimos enviar tu voto. Intentá de nuevo. |

## 8. Estilo visual

- **Tokens:**
  - fondo de página `#F4F3F0`
  - superficie `#FFFFFF`
  - panel de la vista previa `#E9E7E2`
  - texto `#16181D`
  - texto secundario `#3F444F`
  - etiquetas `#5A5F6B`
  - bordes `#E0DED8` / `#D4D2CC`
  - seleccionado `#16181D` con texto blanco
  - foco `#2B4ACB`
- **Radios:** 10–12 px en controles, 16–20 px en tarjetas y paneles.
- **Áreas táctiles:** ≥ 44 px.
- **Foco:** visible en todos los controles.
- **Contraste:** el texto debe cumplir 4.5:1.
- **Idioma:** español de El Salvador, con voseo ("Elegí", "Enviá", "Usá"). `lang="es"`.

## 9. Criterios de aceptación

- [ ] Cambiar fondo, logo, tipografía o carrera actualiza la vista previa al instante, en 1 y en 4 carreras.
- [ ] El logo queda en el pecho según `LOGO_POSITION`, y se ve bien de 320 px a 1440 px.
- [ ] El correo se valida en el cliente y en el servidor (solo `@esen.edu.sv`).
- [ ] Votar dos veces con el mismo correo deja una sola fila en `Votos` (la última), `envios = 2`, y dos filas en `Log`.
- [ ] Con `VOTING_OPEN=false` no se puede votar y la UI lo explica.
- [ ] El dashboard no muestra nombres ni correos.
- [ ] El dashboard calcula bien el top 3, los ganadores por variable y la participación por carrera (cubierto por tests con datos fijos).
- [ ] `npm run build` y `npm test` pasan; el deploy a GitHub Pages funciona con y sin dominio propio.
- [ ] Lighthouse móvil: Accesibilidad ≥ 95.

## 10. Alternativa con identidad verificada (no implementar salvo que se pida)

Si ESEN usa Google Workspace y quien publica el script tiene cuenta `@esen.edu.sv`, se puede servir la página de votación desde el mismo Apps Script (`HtmlService`) con acceso "Cualquier usuario de esen.edu.sv" y leer el correo con `Session.getActiveUser().getEmail()`. Así el correo queda verificado por Google y no se puede suplantar.

Las desventajas:
- La URL sería la de `script.google.com`.
- La página corre dentro de un iframe.
- El frontend tendría que adaptarse a `google.script.run` en vez de `fetch`.
