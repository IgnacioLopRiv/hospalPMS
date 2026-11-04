import { resolveGuestLocale } from './locale-resolver';

describe('resolveGuestLocale', () => {
  it('resuelve español para países hispanohablantes directos', () => {
    expect(resolveGuestLocale('Chile')).toBe('es');
    expect(resolveGuestLocale('CHILE')).toBe('es');
    expect(resolveGuestLocale('chilena')).toBe('es');
    expect(resolveGuestLocale('España')).toBe('es');
    expect(resolveGuestLocale('española')).toBe('es');
    expect(resolveGuestLocale('Colombia')).toBe('es');
    expect(resolveGuestLocale('Argentina')).toBe('es');
    expect(resolveGuestLocale('México')).toBe('es');
    expect(resolveGuestLocale('mexicana')).toBe('es');
    expect(resolveGuestLocale('Perú')).toBe('es');
  });

  it('resuelve español por defecto cuando el país es nulo o vacío', () => {
    expect(resolveGuestLocale(null)).toBe('es');
    expect(resolveGuestLocale(undefined)).toBe('es');
    expect(resolveGuestLocale('')).toBe('es');
    expect(resolveGuestLocale('   ')).toBe('es');
  });

  it('resuelve inglés para países que no hablan español', () => {
    expect(resolveGuestLocale('United States')).toBe('en');
    expect(resolveGuestLocale('USA')).toBe('en');
    expect(resolveGuestLocale('Germany')).toBe('en');
    expect(resolveGuestLocale('Alemana')).toBe('en');
    expect(resolveGuestLocale('France')).toBe('en');
    expect(resolveGuestLocale('Francesa')).toBe('en');
    expect(resolveGuestLocale('Brazil')).toBe('en');
    expect(resolveGuestLocale('Brasileña')).toBe('en');
    expect(resolveGuestLocale('Australia')).toBe('en');
  });
});
