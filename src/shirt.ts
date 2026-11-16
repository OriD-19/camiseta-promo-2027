import { FRASE, LOGO_POSITION, type Career, type Font, type FondoId, type LogoId } from './config';
import { shirtColors } from './colors';
import { h, svg } from './dom';
import './styles/shirt.css';

export type Side = 'front' | 'back';

export interface ShirtProps {
  career: Career;
  fondo: FondoId;
  logo: LogoId;
  font: Font;
  side: Side;
  frase?: string;
}

// Rutas copiadas tal cual de reference/prototipo/Shirt.dc.html.
const BODY_D =
  'M140 26 C162 44 238 44 260 26 L350 58 C360 62 366 70 365 80 L352 142 C350 150 342 154 334 152 L304 144 L306 352 C306 362 298 370 288 370 L112 370 C102 370 94 362 94 352 L96 144 L66 152 C58 154 50 150 48 142 L35 80 C34 70 40 62 50 58 Z';
const NECK_FRONT_D = 'M140 26 C162 60 238 60 260 26';
const NECK_BACK_D = 'M140 26 C162 38 238 38 260 26';
const SEAM_L_D = 'M96 144 C98 116 104 90 116 62';
const SEAM_R_D = 'M304 144 C302 116 296 90 284 62';

/** Expone LOGO_POSITION como variables CSS globales (--logo-left, --logo-top, --logo-width). */
export function applyLogoPosition(root: HTMLElement = document.documentElement): void {
  root.style.setProperty('--logo-left', `${LOGO_POSITION.left}%`);
  root.style.setProperty('--logo-top', `${LOGO_POSITION.top}%`);
  root.style.setProperty('--logo-width', `${LOGO_POSITION.width}%`);
}
if (typeof document !== 'undefined') applyLogoPosition();

export function shirtLabel(career: Career, side: Side): string {
  return `Camiseta ${career.id}, ${side === 'front' ? 'frente' : 'espalda'}`;
}

function logoContent(logo: LogoId, sigla: string, frase: string): HTMLElement[] {
  switch (logo) {
    case 'siglas':
      return [h('div', { class: 'lg-siglas__sigla' }, sigla), h('div', { class: 'lg-siglas__year' }, '2027')];
    case 'linea':
      return [
        h('div', { class: 'lg-linea__sigla' }, sigla),
        h('div', { class: 'lg-linea__rule' }),
        h('div', { class: 'lg-linea__promo' }, 'PROMO 2027'),
      ];
    case 'frase':
      return [
        h('div', { class: 'lg-frase__frase' }, frase),
        h('div', { class: 'lg-frase__sigla' }, sigla),
        h('div', { class: 'lg-frase__year' }, '2027'),
      ];
    case 'insignia':
      return [
        h(
          'div',
          { class: 'lg-insignia__ring' },
          h('div', { class: 'lg-insignia__esen' }, 'ESEN'),
          h('div', { class: 'lg-insignia__sigla' }, sigla),
          h('div', { class: 'lg-insignia__rule' }),
          h('div', { class: 'lg-insignia__year' }, '2027'),
        ),
      ];
  }
}

/** Dibuja la camiseta dentro de `container` (reemplaza su contenido). */
export function renderShirt(container: HTMLElement, props: ShirtProps): void {
  const { career, fondo, logo, font, side } = props;
  const frase = props.frase ?? FRASE;
  const c = shirtColors(career, fondo);

  const root = h('div', { class: 'shirt' });
  root.style.setProperty('--shirt-ink', c.ink);
  root.style.setProperty('--shirt-accent', c.accent);
  root.style.setProperty('--shirt-ff', font.family);
  root.style.setProperty('--shirt-fw', String(font.weight));
  root.style.setProperty('--shirt-ls', font.tracking);

  const s = svg('svg', { viewBox: '0 0 400 390', role: 'img', 'aria-label': shirtLabel(career, side), class: 'shirt__svg' });
  s.append(
    svg('path', { d: BODY_D, fill: c.fill, stroke: c.stroke, 'stroke-width': 2, 'stroke-linejoin': 'round' }),
    svg('path', { d: side === 'front' ? NECK_FRONT_D : NECK_BACK_D, fill: 'none', stroke: c.stroke, 'stroke-width': 2 }),
    svg('path', { d: SEAM_L_D, fill: 'none', stroke: c.stroke, 'stroke-width': 1.5 }),
    svg('path', { d: SEAM_R_D, fill: 'none', stroke: c.stroke, 'stroke-width': 1.5 }),
  );
  root.append(s);

  if (side === 'front') {
    root.append(h('div', { class: `shirt__logo lg-${logo}`, 'aria-hidden': 'true' }, logoContent(logo, career.id, frase)));
  } else {
    root.append(
      h('div', { class: 'shirt__nape', 'aria-hidden': 'true' }, `${career.id} 2027`),
      h(
        'div',
        { class: 'shirt__back-box', 'aria-hidden': 'true' },
        h('div', { class: 'shirt__back-title' }, `Diseño propio de ${career.id}`),
        h('div', { class: 'shirt__back-sub' }, 'Referencias de cada carrera, misma línea gráfica del frente'),
      ),
    );
  }

  container.replaceChildren(root);
}
