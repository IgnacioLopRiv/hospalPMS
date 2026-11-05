export type SupportedLocale = 'es' | 'en';

const SPANISH_SPEAKING_COUNTRIES = new Set<string>([
  'chile',
  'chilena',
  'chileno',
  'argentina',
  'argentino',
  'bolivia',
  'boliviana',
  'boliviano',
  'colombia',
  'colombiana',
  'colombiano',
  'costa rica',
  'costarricense',
  'cuba',
  'cubana',
  'cubano',
  'ecuador',
  'ecuatoriana',
  'ecuatoriano',
  'el salvador',
  'salvadorena',
  'salvadoreno',
  'salvadoreña',
  'salvadoreño',
  'espana',
  'espanol',
  'espanola',
  'españa',
  'español',
  'española',
  'guatemala',
  'guatemalteca',
  'guatemalteco',
  'honduras',
  'hondurena',
  'hondureno',
  'hondureña',
  'hondureño',
  'mexico',
  'mexicana',
  'mexicano',
  'nicaragua',
  'nicaraguense',
  'nicaragüense',
  'panama',
  'panamena',
  'panameno',
  'panameña',
  'panameño',
  'paraguay',
  'paraguaya',
  'paraguayo',
  'peru',
  'peruana',
  'peruano',
  'puerto rico',
  'puertorriquena',
  'puertorriqueno',
  'puertorriqueña',
  'puertorriqueño',
  'republica dominicana',
  'dominicana',
  'dominicano',
  'uruguay',
  'uruguaya',
  'uruguayo',
  'venezuela',
  'venezolana',
  'venezolano',
  'guinea ecuatorial',
  'ecuatoguineana',
  'ecuatoguineano',
]);

/**
 * Normaliza un string eliminando tildes, signos y espacios extra.
 */
function normalizeString(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Resuelve el idioma del huésped basado en su país de residencia o nacionalidad.
 * Si es un país hispanohablante retorna 'es'; de lo contrario 'en'.
 * Si el campo viene vacío o indefinido, usa 'es' por ser el idioma local de operación.
 */
export function resolveGuestLocale(
  countryOrNationality?: string | null,
): SupportedLocale {
  if (!countryOrNationality || !countryOrNationality.trim()) {
    return 'es';
  }

  const normalized = normalizeString(countryOrNationality);

  if (SPANISH_SPEAKING_COUNTRIES.has(normalized)) {
    return 'es';
  }

  for (const country of SPANISH_SPEAKING_COUNTRIES) {
    if (normalized.includes(country)) {
      return 'es';
    }
  }

  return 'en';
}
