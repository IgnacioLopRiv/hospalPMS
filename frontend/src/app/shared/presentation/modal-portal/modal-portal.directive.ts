import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { playModalLeaveAndRemove } from '../animations/modal-leave';

/**
 * Mueve el fondo de un modal a <body> mientras está abierto.
 *
 * Las páginas de Ionic (.ion-page) usan `contain: layout` y `z-index: 0`, así que un
 * elemento `position: fixed` dentro de ellas queda limitado al área de la página:
 * no oscurece el encabezado ni el menú lateral, y esos siguen siendo clicables.
 *
 * Ionic no destruye las páginas al navegar, solo las oculta; por eso el modal se
 * esconde mientras su página de origen está oculta.
 */
@Directive({
  selector: '[appModalPortal]',
  standalone: true,
})
export class ModalPortalDirective implements AfterViewInit, OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private pageObserver?: MutationObserver;
  private moved = false;

  ngAfterViewInit(): void {
    // Fuera de una página de Ionic no hay contención que evitar.
    const page = this.element.closest('ion-router-outlet > .ion-page');
    if (!page) return;
    this.document.body.appendChild(this.element);
    this.moved = true;

    const syncVisibility = () => {
      // style.display en vez de `hidden`, porque los estilos del modal fijan display: flex.
      const pageHidden = page.classList.contains('ion-page-hidden') || page.classList.contains('ion-page-invisible');
      this.element.style.display = pageHidden ? 'none' : '';
    };
    syncVisibility();
    this.pageObserver = new MutationObserver(syncVisibility);
    this.pageObserver.observe(page, { attributes: true, attributeFilter: ['class'] });
  }

  ngOnDestroy(): void {
    this.pageObserver?.disconnect();
    // Solo se anima el cierre si el modal está a la vista (no al salir de la página).
    if (!this.moved || this.element.style.display === 'none') {
      this.element.remove();
      return;
    }
    // Angular ya lo sacó del DOM si era la raíz del @if; se vuelve a poner para animar la salida.
    if (!this.element.isConnected) this.document.body.appendChild(this.element);
    playModalLeaveAndRemove(this.element);
  }
}
