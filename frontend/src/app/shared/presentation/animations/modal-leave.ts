/**
 * Animación de cierre de los modals que no son ion-modal (los ion-modal / ion-alert
 * ya cierran con `modalLeaveAnimation` de overlay-animations.ts).
 *
 * La clase `hospal-modal-leaving` (definida en global.scss) desvanece el fondo y
 * encoge el panel igual que el cierre de "Gestionar perfiles". Se aplica de tres formas:
 *  - Modals con `@if`: `animate.leave="hospal-modal-leaving"` en el elemento raíz.
 *  - Modals con `appModalPortal`: la directiva llama a `playModalLeaveAndRemove`.
 *  - `<dialog>` nativos: `closeDialogAnimated` en lugar de `dialog.close()`.
 */
export const MODAL_LEAVING_CLASS = 'hospal-modal-leaving';

/** Margen de seguridad por si `animationend` nunca llega (pestaña oculta, etc.). */
const LEAVE_FALLBACK_MS = 400;

/** Añade la clase de salida y quita el elemento del DOM cuando termina la animación. */
export function playModalLeaveAndRemove(el: HTMLElement): void {
  el.classList.add(MODAL_LEAVING_CLASS);
  if (getComputedStyle(el).animationName === 'none') {
    el.remove();
    return;
  }

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(fallback);
    el.removeEventListener('animationend', onEnd);
    el.remove();
  };
  const onEnd = (event: AnimationEvent) => {
    if (event.target === el) finish();
  };
  el.addEventListener('animationend', onEnd);
  const fallback = setTimeout(finish, LEAVE_FALLBACK_MS);
}

/**
 * Cierra un `<dialog>` modal con animación.
 *
 * El diálogo real se cierra al instante (foco, estado y lógica del componente no cambian)
 * y en su lugar se anima una copia visual inerte, para que el contenido no se vacíe a
 * mitad de la animación cuando el componente limpia su estado tras cerrar.
 */
export function closeDialogAnimated(dialog: HTMLDialogElement | null | undefined): void {
  if (!dialog?.open) return;

  const doc = dialog.ownerDocument;
  const ghost = doc.createElement('div');
  for (const attr of Array.from(dialog.attributes)) {
    if (attr.name !== 'open' && attr.name !== 'id') ghost.setAttribute(attr.name, attr.value);
  }
  ghost.classList.add(MODAL_LEAVING_CLASS);
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  ghost.append(...Array.from(dialog.childNodes, (node) => node.cloneNode(true)));
  ghost.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));

  // cloneNode no copia lo escrito en los campos (propiedad `value`, no atributo).
  const sourceFields = dialog.querySelectorAll<HTMLInputElement & HTMLSelectElement>('input, textarea, select');
  const ghostFields = ghost.querySelectorAll<HTMLInputElement & HTMLSelectElement>('input, textarea, select');
  sourceFields.forEach((field, i) => {
    const copy = ghostFields[i];
    if (!copy) return;
    copy.value = field.value;
    if ('checked' in field) copy.checked = field.checked;
  });

  doc.body.appendChild(ghost);

  // Mantiene el scroll interno del modal para que el contenido no salte arriba.
  const sourceEls = dialog.querySelectorAll('*');
  const ghostEls = ghost.querySelectorAll('*');
  sourceEls.forEach((el, i) => {
    if (el.scrollTop || el.scrollLeft) {
      ghostEls[i]?.scrollTo(el.scrollLeft, el.scrollTop);
    }
  });

  dialog.close();
  playModalLeaveAndRemove(ghost);
}
