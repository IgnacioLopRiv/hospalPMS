import { Animation, createAnimation } from '@ionic/angular/standalone';

/**
 * Animación única de apertura/cierre para todos los overlays de Ionic
 * (ion-modal e ion-alert). Replica la animación del modal "Gestionar perfiles"
 * (fade + scale 0.96 + leve desplazamiento vertical), pero ejecutada en un
 * solo paso sobre el wrapper y con propiedades que corren en el compositor
 * (transform / opacity), evitando la doble animación Ionic + CSS que se veía
 * entrecortada.
 *
 * Mantener sincronizado con las variables `--hospal-modal-*` de global.scss.
 */
const ENTER_DURATION = 280;
const LEAVE_DURATION = 180;
const ENTER_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const LEAVE_EASING = 'cubic-bezier(0.4, 0, 1, 1)';

const HIDDEN_TRANSFORM = 'translate3d(0, 12px, 0) scale(0.96)';
const VISIBLE_TRANSFORM = 'translate3d(0, 0, 0) scale(1)';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function buildOverlayAnimation(
  baseEl: HTMLElement,
  wrapperSelector: string,
  direction: 'enter' | 'leave',
): Animation {
  const root: ParentNode = baseEl.shadowRoot ?? baseEl;
  const backdropEl = root.querySelector('ion-backdrop');
  const wrapperEl = root.querySelector(wrapperSelector);
  const reduced = prefersReducedMotion();

  const backdrop = createAnimation()
    .fromTo('opacity', '0.01', 'var(--backdrop-opacity)')
    .beforeStyles({ 'pointer-events': 'none' })
    .afterClearStyles(['pointer-events']);
  if (backdropEl) backdrop.addElement(backdropEl);

  const wrapper = createAnimation().beforeStyles({ 'will-change': 'transform, opacity' }).afterClearStyles(['will-change']);
  if (wrapperEl) wrapper.addElement(wrapperEl);
  wrapper.keyframes([
    { offset: 0, opacity: '0', transform: reduced ? VISIBLE_TRANSFORM : HIDDEN_TRANSFORM },
    { offset: 1, opacity: '1', transform: VISIBLE_TRANSFORM },
  ]);

  const animation = createAnimation()
    .addElement(baseEl)
    .addAnimation([backdrop, wrapper]);

  return direction === 'enter'
    ? animation.easing(ENTER_EASING).duration(reduced ? 120 : ENTER_DURATION)
    : animation.easing(LEAVE_EASING).duration(reduced ? 100 : LEAVE_DURATION).direction('reverse');
}

export const modalEnterAnimation = (baseEl: HTMLElement): Animation =>
  buildOverlayAnimation(baseEl, '.modal-wrapper', 'enter');

export const modalLeaveAnimation = (baseEl: HTMLElement): Animation =>
  buildOverlayAnimation(baseEl, '.modal-wrapper', 'leave');

export const alertEnterAnimation = (baseEl: HTMLElement): Animation =>
  buildOverlayAnimation(baseEl, '.alert-wrapper', 'enter');

export const alertLeaveAnimation = (baseEl: HTMLElement): Animation =>
  buildOverlayAnimation(baseEl, '.alert-wrapper', 'leave');
