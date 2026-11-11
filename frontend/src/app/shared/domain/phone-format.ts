// Metadata "max": incluye los largos por tipo de línea (móvil/fijo), que la "min" no trae.
import { CountryCode, isSupportedCountry, Metadata, parsePhoneNumberFromString } from 'libphonenumber-js/max';

export const PHONE_FORMAT_ERROR = 'El número no tiene un formato válido para el país seleccionado.';

/** Máximo de dígitos de un número internacional (E.164). */
const MAX_PHONE_DIGITS = 15;
const GUEST_LINE_TYPES = ['MOBILE', 'FIXED_LINE', 'FIXED_LINE_OR_MOBILE'] as const;
const maxLengthByCountry = new Map<string, number>();

/** Partes de la API de Metadata que la librería usa internamente pero no tipa. */
interface NumberingPlanInternals {
  possibleLengths(): number[];
  type?(type: string): { possibleLengths(): number[] } | undefined;
  nationalPrefix?(): string | undefined;
}

/**
 * Cantidad máxima de dígitos que puede tener un teléfono móvil o fijo del país
 * (ej. Chile 9, EE.UU. 10). Se ignoran los números especiales (800, 600, ...)
 * porque no son teléfonos de huéspedes.
 */
export function maxPhoneDigits(countryIso: string): number {
  const iso = countryIso.trim().toUpperCase();
  const cached = maxLengthByCountry.get(iso);
  if (cached !== undefined) {
    return cached;
  }

  let max = MAX_PHONE_DIGITS;
  if (isSupportedCountry(iso)) {
    const plan = numberingPlan(iso as CountryCode);
    const lineLengths = GUEST_LINE_TYPES.flatMap((type) => {
      try {
        return plan.type?.(type)?.possibleLengths() ?? [];
      } catch {
        return [];
      }
    });
    // Si la API interna cambiara, se usa el largo máximo general del país (API pública).
    const lengths = lineLengths.length ? lineLengths : plan.possibleLengths();
    if (lengths.length) {
      max = Math.min(Math.max(...lengths), MAX_PHONE_DIGITS);
    }
  }

  maxLengthByCountry.set(iso, max);
  return max;
}

/**
 * Deja solo dígitos y corta el número al máximo del país. Si la persona escribe
 * el prefijo nacional (ej. el "0" en Reino Unido) se le permite ese dígito extra.
 */
export function limitPhoneDigits(countryIso: string, value: string): string {
  const digits = value.replace(/\D/g, '');
  const iso = countryIso.trim().toUpperCase();
  let max = maxPhoneDigits(iso);
  if (isSupportedCountry(iso)) {
    const prefix = numberingPlan(iso as CountryCode).nationalPrefix?.();
    if (prefix && digits.startsWith(prefix)) {
      max += prefix.length;
    }
  }
  return digits.slice(0, Math.min(max, MAX_PHONE_DIGITS));
}

function numberingPlan(iso: CountryCode): NumberingPlanInternals {
  const metadata = new Metadata();
  metadata.selectNumberingPlan(iso);
  return metadata.numberingPlan as unknown as NumberingPlanInternals;
}

export interface PhoneFormatResult {
  valid: boolean;
  /** Código telefónico sin "+" (ej. "56"). */
  countryCallingCode: string;
  /** Número nacional normalizado, solo dígitos. */
  nationalNumber: string;
  /** Formato E.164 (ej. "+56912345678"). */
  e164: string;
}

/** true si el número es válido para el país (atajo de checkPhoneFormat). */
export function isValidPhoneFormat(countryIso: string, nationalNumber: string): boolean {
  return checkPhoneFormat(countryIso, nationalNumber)?.valid === true;
}

/**
 * Validación local y gratuita: estructura, cantidad de dígitos y rangos de
 * numeración asignados en cada país, según los datos de libphonenumber.
 * No confirma que la línea esté activa: eso requiere consultar al operador (de pago).
 * @param countryIso código ISO 3166-1 alpha-2, en cualquier mayúscula/minúscula (ej. "cl").
 * @param nationalNumber número sin código de país.
 */
export function checkPhoneFormat(countryIso: string, nationalNumber: string): PhoneFormatResult | null {
  const iso = countryIso.trim().toUpperCase();
  const digits = nationalNumber.replace(/\D/g, '');
  if (!digits || !isSupportedCountry(iso)) {
    return null;
  }

  const parsed = parsePhoneNumberFromString(digits, iso as CountryCode);
  if (!parsed) {
    return null;
  }

  return {
    valid: parsed.isValid() && parsed.country === iso,
    countryCallingCode: parsed.countryCallingCode,
    nationalNumber: parsed.nationalNumber,
    e164: parsed.number,
  };
}
