/** Validación y formato de los datos del huésped en el formulario de ingreso. */

export function isValidEmail(value: string): boolean {
  return /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i.test(value.trim());
}

export function isValidRut(value: string): boolean {
  const rut = value.replace(/[.\s-]/g, '').toUpperCase();
  if (!/^\d{7,8}[0-9K]$/.test(rut) || /^0+$/.test(rut)) {
    return false;
  }

  const body = rut.slice(0, -1);
  let multiplier = 2;
  const sum = [...body].reverse().reduce((total, digit) => {
    const updatedTotal = total + Number(digit) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
    return updatedTotal;
  }, 0);
  const remainder = 11 - (sum % 11);
  const verifier = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);
  return rut.endsWith(verifier);
}

/** Da formato `12.345.678-5` a lo que se va escribiendo. */
export function formatRut(value: string): string {
  const cleaned = value.replace(/[^0-9k]/gi, '').toUpperCase();
  const hasCheckDigitK = cleaned.endsWith('K');
  const digits = cleaned.replace(/\D/g, '').slice(0, 9);

  if (digits.length === 0) return '';

  if (hasCheckDigitK) {
    const body = digits.slice(0, 8);
    return body ? `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-K` : 'K';
  }

  // El último dígito siempre es el verificador, sea cual sea el largo del RUT.
  return digits.length === 1
    ? digits
    : `${digits.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${digits.slice(-1)}`;
}

export function sanitizeDigits(value: string, maxLength = 20): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

/** Documento sin puntos, guiones ni espacios, para comparar duplicados. */
export function normalizeDocument(value: string): string {
  return value.replace(/[.\s-]/g, '').toUpperCase();
}
