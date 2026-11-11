import { checkPhoneFormat, isValidPhoneFormat, limitPhoneDigits, maxPhoneDigits } from './phone-format';

describe('phone-format', () => {
  it('acepta números válidos según el país', () => {
    expect(isValidPhoneFormat('cl', '961234567')).toBeTrue();
    expect(isValidPhoneFormat('CL', '9 6123 4567')).toBeTrue();
    expect(isValidPhoneFormat('us', '2015550123')).toBeTrue();
  });

  it('rechaza números con largo o prefijo incorrecto', () => {
    expect(isValidPhoneFormat('cl', '12345')).toBeFalse();
    // Rango 91 no asignado a móviles en Chile según la metadata completa.
    expect(isValidPhoneFormat('cl', '912345678')).toBeFalse();
    expect(isValidPhoneFormat('cl', '9123456789')).toBeFalse();
    expect(isValidPhoneFormat('us', '912345678')).toBeFalse();
    expect(isValidPhoneFormat('cl', '')).toBeFalse();
  });

  it('rechaza países desconocidos', () => {
    expect(checkPhoneFormat('xx', '912345678')).toBeNull();
  });

  it('calcula el máximo de dígitos de móviles y fijos por país', () => {
    expect(maxPhoneDigits('cl')).toBe(9);
    expect(maxPhoneDigits('us')).toBe(10);
    expect(maxPhoneDigits('ar')).toBe(11);
    expect(maxPhoneDigits('xx')).toBe(15);
  });

  it('corta los dígitos sobrantes según el país', () => {
    expect(limitPhoneDigits('cl', '9 1234 5678 999')).toBe('912345678');
    expect(limitPhoneDigits('us', '201-555-0123-45')).toBe('2015550123');
  });

  it('permite el prefijo nacional además del máximo', () => {
    expect(limitPhoneDigits('gb', '074001234567')).toBe('07400123456');
  });

  it('entrega el número normalizado en E.164', () => {
    expect(checkPhoneFormat('cl', '961234567')).toEqual({
      valid: true,
      countryCallingCode: '56',
      nationalNumber: '961234567',
      e164: '+56961234567',
    });
  });
});
