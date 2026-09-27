import { Component, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CountryOption } from '../../domain/country-options';

@Component({
  selector: 'app-country-picker',
  standalone: true,
  templateUrl: './country-picker.component.html',
  styleUrl: './country-picker.component.scss',
})
export class CountryPickerComponent {
  @Input({ required: true }) countries: CountryOption[] = [];
  @Input() value = '';
  @Input() mode: 'callingCode' | 'countryName' = 'countryName';
  @Input() placeholder = 'Selecciona un país';
  @Input() ariaLabel = 'Seleccionar país';
  @Output() readonly valueChange = new EventEmitter<string>();

  isOpen = false;

  get selectedCountry(): CountryOption | undefined {
    return this.countries.find((country) =>
      this.mode === 'callingCode' ? country.code === this.value : country.countryName === this.value
    );
  }

  toggleOptions(): void {
    this.isOpen = !this.isOpen;
  }

  selectCountry(country: CountryOption): void {
    this.valueChange.emit(this.mode === 'callingCode' ? country.code : country.countryName);
    this.isOpen = false;
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: Event): void {
    if (event.target instanceof Node && !this.element.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.isOpen = false;
  }

  constructor(private readonly element: ElementRef<HTMLElement>) {}
}
