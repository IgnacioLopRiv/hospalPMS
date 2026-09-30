import { ComponentFixture, TestBed } from '@angular/core/testing';
import { COUNTRY_OPTIONS, CountryOption } from '../../domain/country-options';
import { CountryPickerComponent } from './country-picker.component';

describe('CountryPickerComponent', () => {
  let component: CountryPickerComponent;
  let fixture: ComponentFixture<CountryPickerComponent>;

  const countries: CountryOption[] = [
    { code: 'es', nationality: 'Española', countryName: 'España', callingCode: '+34' },
    { code: 'ar', nationality: 'Argentina', countryName: 'Argentina', callingCode: '+54' },
  ];
  const latinAmericanCountryCodes = new Set([
    'ar', 'bo', 'br', 'cl', 'co', 'cr', 'cu', 'do', 'ec', 'gf', 'gt',
    'ht', 'hn', 'mx', 'ni', 'pa', 'pe', 'pr', 'py', 'sv', 'uy', 've',
  ]);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CountryPickerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CountryPickerComponent);
    component = fixture.componentInstance;
    component.countries = countries;
    fixture.detectChanges();
  });

  it('filters country names without requiring accent marks', () => {
    component.searchTerm = 'espana';

    expect(component.filteredCountries).toEqual([countries[0]]);
  });

  it('filters countries by calling code', () => {
    component.mode = 'callingCode';
    component.searchTerm = '+54';

    expect(component.filteredCountries).toEqual([countries[1]]);
  });

  it('lists Chile first, followed by Latin American countries', () => {
    expect(COUNTRY_OPTIONS[0].code).toBe('cl');

    const firstNonLatinAmericanIndex = COUNTRY_OPTIONS.findIndex(
      (country) => !latinAmericanCountryCodes.has(country.code)
    );
    expect(firstNonLatinAmericanIndex).toBeGreaterThan(0);
    expect(COUNTRY_OPTIONS.slice(0, firstNonLatinAmericanIndex)
      .every((country) => latinAmericanCountryCodes.has(country.code))).toBeTrue();
  });

  it('searches only by country name in country mode', () => {
    component.mode = 'countryName';
    component.searchTerm = 'arg';

    expect(component.filteredCountries).toEqual([countries[1]]);

    component.searchTerm = '+54';
    expect(component.filteredCountries).toEqual([]);
  });

  it('keeps the popover hidden until the picker is opened', () => {
    const root = fixture.nativeElement as HTMLElement;
    const options = root.querySelector<HTMLDivElement>('.country-picker-options');
    if (!options) {
      throw new Error('Country picker options should be rendered');
    }

    expect(options.matches(':popover-open')).toBeFalse();
    expect(getComputedStyle(options).display).toBe('none');
  });

  it('opens the top-layer list and filters as the user types', () => {
    const root = fixture.nativeElement as HTMLElement;
    const trigger = root.querySelector<HTMLButtonElement>('.country-picker-trigger');
    const options = root.querySelector<HTMLDivElement>('.country-picker-options');
    if (!trigger || !options) {
      throw new Error('Country picker controls should be rendered');
    }

    trigger.click();
    fixture.detectChanges();

    expect(options.matches(':popover-open')).toBeTrue();
    expect(document.activeElement).toBe(root.querySelector('.country-picker-search'));

    const searchInput = root.querySelector<HTMLInputElement>('.country-picker-search');
    if (!searchInput) {
      throw new Error('Country picker search should be rendered');
    }

    searchInput.value = 'arg';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(root.querySelectorAll('.country-picker-option').length).toBe(1);
  });

  it('closes when focus moves to another form field', () => {
    const root = fixture.nativeElement as HTMLElement;
    const trigger = root.querySelector<HTMLButtonElement>('.country-picker-trigger');
    const options = root.querySelector<HTMLDivElement>('.country-picker-options');
    const otherField = document.createElement('input');
    document.body.appendChild(otherField);
    if (!trigger || !options) {
      throw new Error('Country picker controls should be rendered');
    }

    trigger.click();
    fixture.detectChanges();
    otherField.focus();
    fixture.detectChanges();

    expect(options.matches(':popover-open')).toBeFalse();
    expect(component.isOpen).toBeFalse();

    otherField.remove();
  });

  it('synchronizes its state when the browser dismisses the popover', () => {
    const root = fixture.nativeElement as HTMLElement;
    const trigger = root.querySelector<HTMLButtonElement>('.country-picker-trigger');
    const options = root.querySelector<HTMLDivElement>('.country-picker-options');
    if (!trigger || !options) {
      throw new Error('Country picker controls should be rendered');
    }

    trigger.click();
    fixture.detectChanges();
    options.hidePopover();
    options.dispatchEvent(new Event('toggle'));
    fixture.detectChanges();

    expect(component.isOpen).toBeFalse();
  });
});
