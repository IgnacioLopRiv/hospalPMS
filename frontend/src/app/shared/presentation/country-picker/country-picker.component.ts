import { Component, ElementRef, EventEmitter, HostListener, inject, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { CountryOption } from '../../domain/country-options';

@Component({
  selector: 'app-country-picker',
  standalone: true,
  templateUrl: './country-picker.component.html',
  styleUrl: './country-picker.component.scss',
})
export class CountryPickerComponent implements OnDestroy {
  private readonly element: ElementRef<HTMLElement> = inject(ElementRef);

  @ViewChild('options', { static: true }) private optionsElement!: ElementRef<HTMLDivElement>;
  @ViewChild('searchInput', { static: true }) private searchInput!: ElementRef<HTMLInputElement>;

  @Input({ required: true }) countries: CountryOption[] = [];
  @Input() value = '';
  @Input() mode: 'callingCode' | 'countryName' = 'countryName';
  @Input() placeholder = 'Selecciona un país';
  @Input() ariaLabel = 'Seleccionar país';
  @Output() readonly valueChange = new EventEmitter<string>();

  isOpen = false;
  searchTerm = '';

  private readonly handleDocumentScroll = (): void => {
    if (this.isOpen) {
      this.positionOptions();
    }
  };

  get filteredCountries(): CountryOption[] {
    const query = this.normalizeSearchTerm(this.searchTerm.trim());
    if (!query) {
      return this.countries;
    }

    return this.countries.filter((country) => {
      const searchValues = this.mode === 'callingCode'
        ? [country.countryName, country.nationality, country.callingCode, country.code]
        : [country.countryName];
      return searchValues.some((value) => this.normalizeSearchTerm(value).includes(query));
    });
  }

  get selectedCountry(): CountryOption | undefined {
    return this.countries.find((country) =>
      this.mode === 'callingCode' ? country.code === this.value : country.countryName === this.value
    );
  }

  toggleOptions(): void {
    if (this.optionsElement.nativeElement.matches(':popover-open')) {
      this.closeOptions();
      return;
    }

    this.searchTerm = '';
    this.optionsElement.nativeElement.showPopover();
    this.isOpen = true;
    this.positionOptions();
    this.searchInput.nativeElement.focus();
  }

  syncOpenState(): void {
    this.isOpen = this.optionsElement.nativeElement.matches(':popover-open');
    if (!this.isOpen) {
      this.searchTerm = '';
    }
  }

  selectCountry(country: CountryOption): void {
    this.valueChange.emit(this.mode === 'callingCode' ? country.code : country.countryName);
    this.closeOptions();
  }

  updateSearch(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.searchTerm = event.target.value;
    }
  }

  @HostListener('window:resize')
  repositionOptions(): void {
    if (this.isOpen) {
      this.positionOptions();
    }
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: Event): void {
    if (
      event.target instanceof Node &&
      !this.element.nativeElement.contains(event.target) &&
      !this.optionsElement.nativeElement.contains(event.target)
    ) {
      this.closeOptions();
    }
  }

  @HostListener('document:focusin', ['$event'])
  closeOnFocusOutside(event: FocusEvent): void {
    if (
      event.target instanceof Node &&
      !this.element.nativeElement.contains(event.target) &&
      !this.optionsElement.nativeElement.contains(event.target)
    ) {
      this.closeOptions();
    }
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    if (this.isOpen) {
      this.closeOptions();
      this.element.nativeElement.querySelector<HTMLButtonElement>('.country-picker-trigger')?.focus();
    }
  }

  constructor() {
    this.element.nativeElement.ownerDocument.addEventListener('scroll', this.handleDocumentScroll, true);
  }

  ngOnDestroy(): void {
    this.element.nativeElement.ownerDocument.removeEventListener('scroll', this.handleDocumentScroll, true);
  }

  private closeOptions(): void {
    this.isOpen = false;
    if (this.optionsElement.nativeElement.matches(':popover-open')) {
      this.optionsElement.nativeElement.hidePopover();
    }
  }

  private positionOptions(): void {
    const trigger = this.element.nativeElement.querySelector<HTMLButtonElement>('.country-picker-trigger');
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = this.element.nativeElement.ownerDocument.documentElement.clientWidth;
    const viewportHeight = this.element.nativeElement.ownerDocument.defaultView?.innerHeight ?? 0;
    const horizontalPadding = 8;
    const availableBelow = viewportHeight - rect.bottom - 8;
    const availableAbove = rect.top - 8;
    const openAbove = availableBelow < 184 && availableAbove > availableBelow;
    const availableHeight = openAbove ? availableAbove : availableBelow;
    const maxHeight = Math.max(0, Math.min(240, availableHeight - 8));
    const width = Math.min(rect.width, viewportWidth - horizontalPadding * 2);
    const left = Math.min(
      Math.max(horizontalPadding, rect.left),
      viewportWidth - horizontalPadding - width
    );
    const options = this.optionsElement.nativeElement;

    options.style.left = `${left}px`;
    options.style.width = `${width}px`;
    options.style.maxHeight = `${maxHeight}px`;
    const optionsHeight = options.getBoundingClientRect().height;
    options.style.top = `${openAbove ? rect.top - optionsHeight - 4 : rect.bottom + 4}px`;
  }

  private normalizeSearchTerm(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  }
}
