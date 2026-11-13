import { Directive, OnDestroy, OnInit, output } from '@angular/core';

/** Modales abiertos, en orden de apertura: solo el último (el de más arriba) responde a Escape. */
const openModals: EscapeCloseDirective[] = [];

/** Overlays propios de Ionic (selects, popovers…) que ya manejan Escape por su cuenta. */
const IONIC_OVERLAYS = 'ion-alert, ion-popover, ion-action-sheet, ion-picker, ion-loading';

let listening = false;

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  const top = openModals[openModals.length - 1];
  if (!top) return;
  // Un overlay de Ionic o un <dialog> nativo abierto ya cierran con Escape por sí mismos.
  const ionicOverlayOpen = Array.from(document.querySelectorAll(IONIC_OVERLAYS))
    .some((el) => !el.classList.contains('overlay-hidden'));
  if (ionicOverlayOpen || document.querySelector('dialog[open]')) return;
  event.preventDefault();
  top.escapeClose.emit();
}

/**
 * Cierra un modal al presionar Escape.
 *
 * Uso: `<div class="modal-backdrop" appEscapeClose (escapeClose)="cerrar()">`.
 * Si hay varios modales abiertos (p. ej. una confirmación sobre un formulario),
 * solo se cierra el que está encima.
 */
@Directive({
  selector: '[appEscapeClose]',
  standalone: true,
})
export class EscapeCloseDirective implements OnInit, OnDestroy {
  readonly escapeClose = output<void>();

  ngOnInit(): void {
    openModals.push(this);
    if (!listening) {
      document.addEventListener('keydown', onKeydown);
      listening = true;
    }
  }

  ngOnDestroy(): void {
    const index = openModals.indexOf(this);
    if (index >= 0) openModals.splice(index, 1);
  }
}
