import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const PREFIX = 'v1:';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Cifra las credenciales de los proveedores POS con AES-256-GCM.
 * La clave se deriva (SHA-256) de la variable de entorno POS_ENCRYPTION_KEY.
 */
@Injectable()
export class PosCryptoService {
  constructor(private readonly config: ConfigService) {}

  encrypt(values: Record<string, string>): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(values), 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return PREFIX + Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(payload: string | null): Record<string, string> {
    if (!payload) return {};
    if (!payload.startsWith(PREFIX)) {
      throw new InternalServerErrorException(
        'Las credenciales POS guardadas tienen un formato desconocido.',
      );
    }
    const raw = Buffer.from(payload.slice(PREFIX.length), 'base64');
    const iv = raw.subarray(0, IV_LENGTH);
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const data = raw.subarray(IV_LENGTH + TAG_LENGTH);
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key(), iv);
      decipher.setAuthTag(tag);
      const json = Buffer.concat([
        decipher.update(data),
        decipher.final(),
      ]).toString('utf8');
      return JSON.parse(json) as Record<string, string>;
    } catch {
      throw new InternalServerErrorException(
        'No se pudieron descifrar las credenciales POS. ¿Cambió POS_ENCRYPTION_KEY?',
      );
    }
  }

  private key(): Buffer {
    const secret = this.config.get<string>('POS_ENCRYPTION_KEY');
    if (!secret || secret.length < 16) {
      throw new InternalServerErrorException(
        'Falta configurar POS_ENCRYPTION_KEY (mínimo 16 caracteres) en el backend.',
      );
    }
    return createHash('sha256').update(secret).digest();
  }
}
