import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronDownOutline, searchOutline } from 'ionicons/icons';
import { PosProviderInfo } from '../../domain/pos.repository';

let nextId = 0;

/** Quita tildes y mayúsculas para buscar "transbank" con "TRÁNSBANK", etc. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Lista desplegable con buscador para elegir el proveedor POS.
 * Los proveedores no disponibles se muestran deshabilitados con su nota.
 */
@Component({
  selector: 'app-pos-provider-picker',
  templateUrl: './pos-provider-picker.component.html',
  styleUrls: ['./pos-provider-picker.component.scss'],
  standalone: true,
  imports: [IonIcon],
})
export class PosProviderPickerComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly providers = input<PosProviderInfo[]>([]);
  readonly value = input<string | null>(null);
  readonly disabled = input(false);
  readonly selected = output<string>();

  readonly open = signal(false);
  readonly query = signal('');
  readonly activeIndex = signal(0);

  readonly listboxId = `pos-provider-listbox-${nextId++}`;
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('search');

  readonly current = computed(() => this.providers().find((provider) => provider.code === this.value()) ?? null);

  readonly filtered = computed(() => {
    const terms = normalize(this.query().trim()).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return this.providers();
    return this.providers().filter((provider) => {
      const haystack = normalize(
        [provider.nombre, provider.descripcion, provider.code, ...provider.etiquetas].join(' '),
      );
      return terms.every((term) => haystack.includes(term));
    });
  });

  constructor() {
    addIcons({ chevronDownOutline, searchOutline });
  }

  optionId(index: number): string {
    return `${this.listboxId}-opt-${index}`;
  }

  toggle(): void {
    if (this.open()) {
      this.close();
    } else {
      this.openPanel();
    }
  }

  openPanel(): void {
    if (this.disabled()) return;
    this.query.set('');
    const index = this.filtered().findIndex((provider) => provider.code === this.value());
    this.activeIndex.set(Math.max(index, 0));
    this.open.set(true);
    setTimeout(() => this.searchInput()?.nativeElement.focus());
  }

  close(): void {
    this.open.set(false);
  }

  onQuery(value: string): void {
    this.query.set(value);
    const first = this.filtered().findIndex((provider) => provider.disponible);
    this.activeIndex.set(Math.max(first, 0));
  }

  choose(provider: PosProviderInfo): void {
    if (!provider.disponible) return;
    this.selected.emit(provider.code);
    this.close();
  }

  onKeydown(event: KeyboardEvent): void {
    const options = this.filtered();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.set(Math.min(this.activeIndex() + 1, options.length - 1));
        this.scrollActiveIntoView();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.set(Math.max(this.activeIndex() - 1, 0));
        this.scrollActiveIntoView();
        break;
      case 'Enter': {
        event.preventDefault();
        const option = options[this.activeIndex()];
        if (option) this.choose(option);
        break;
      }
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.close();
        break;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  private scrollActiveIntoView(): void {
    setTimeout(() =>
      this.host.nativeElement
        .querySelector(`#${this.optionId(this.activeIndex())}`)
        ?.scrollIntoView({ block: 'nearest' }),
    );
  }
}
