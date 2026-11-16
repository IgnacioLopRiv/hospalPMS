import { Component, ElementRef, EventEmitter, HostListener, Input, NgZone, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronDownOutline, personOutline } from 'ionicons/icons';
import { Habitacion, SedeTipologia } from '../../domain/hostal.model';

/**
 * Selector de habitación con el mismo diseño que el de tipologías (Habitaciones):
 * cada opción muestra el número de habitación, su tipología (con su color) y la capacidad.
 */
@Component({
  selector: 'app-room-picker',
  standalone: true,
  imports: [IonIcon],
  templateUrl: './room-picker.component.html',
  styleUrls: ['./room-picker.component.scss'],
})
export class RoomPickerComponent implements OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);

  @Input() rooms: Habitacion[] = [];
  @Input() typologies: SedeTipologia[] = [];
  /** Id de la habitación elegida, como string ('' = ninguna). */
  @Input() value = '';
  @Input() disabled = false;
  @Input() placeholder = 'Selecciona una habitación';
  @Output() valueChange = new EventEmitter<string>();

  open = false;

  constructor() {
    addIcons({ chevronDownOutline, personOutline });
  }

  get selected(): Habitacion | undefined {
    return this.rooms.find((room) => String(room.id_habitacion) === String(this.value));
  }

  isSelected(room: Habitacion): boolean {
    return String(room.id_habitacion) === String(this.value);
  }

  typologyOf(room: Habitacion): SedeTipologia | undefined {
    return this.typologies.find((typology) => typology.id === room.id_tipologia);
  }

  /** Posición fija de la lista: así sobresale del modal en vez de quedar recortada por él. */
  listStyle: Record<string, string> = {};

  toggle(): void {
    if (this.disabled) return;
    this.open = !this.open;
    if (this.open) this.positionList();
  }

  private positionList(): void {
    const trigger = this.host.nativeElement.querySelector('.room-picker-trigger') as HTMLElement | null;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const maxHeight = 260;
    const below = window.innerHeight - rect.bottom - gap - 8;
    const above = rect.top - gap - 8;
    // Se abre hacia arriba solo si abajo no cabe y arriba hay más espacio.
    const openUp = below < 160 && above > below;
    this.listStyle = {
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      maxHeight: `${Math.min(maxHeight, openUp ? above : below)}px`,
      ...(openUp
        ? { bottom: `${window.innerHeight - rect.top + gap}px` }
        : { top: `${rect.bottom + gap}px` }),
    };
  }

  /** Si se hace scroll fuera de la lista o cambia el tamaño, se cierra (la posición quedaría desfasada). */
  @HostListener('window:resize')
  onResize(): void {
    this.open = false;
  }

  // El scroll no burbujea: se escucha en captura para enterarse también del scroll del modal.
  private readonly onScroll = (event: Event): void => {
    if (!this.open) return;
    const list = this.host.nativeElement.querySelector('.room-options');
    if (list && event.target instanceof Node && list.contains(event.target)) return;
    this.zone.run(() => (this.open = false));
  };

  ngOnInit(): void {
    document.addEventListener('scroll', this.onScroll, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.onScroll, true);
  }

  select(room: Habitacion): void {
    this.value = String(room.id_habitacion);
    this.valueChange.emit(this.value);
    this.open = false;
  }

  close(event?: Event): void {
    event?.stopPropagation();
    this.open = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.open && !this.host.nativeElement.contains(event.target as Node)) this.open = false;
  }
}
