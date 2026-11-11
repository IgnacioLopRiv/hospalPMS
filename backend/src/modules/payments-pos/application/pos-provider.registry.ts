import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  POS_PROVIDERS,
  PosProvider,
  PosProviderInfo,
} from '../domain/pos-provider';

@Injectable()
export class PosProviderRegistry {
  private readonly byCode: Map<string, PosProvider>;

  constructor(@Inject(POS_PROVIDERS) providers: PosProvider[]) {
    this.byCode = new Map(providers.map((p) => [p.code, p]));
  }

  list(): PosProviderInfo[] {
    return [...this.byCode.values()].map(
      ({
        code,
        nombre,
        descripcion,
        modo,
        disponible,
        nota,
        etiquetas,
        campos,
        soportaCobros,
      }) => ({
        soportaCobros,
        code,
        nombre,
        descripcion,
        modo,
        disponible,
        nota,
        etiquetas,
        campos,
      }),
    );
  }

  get(code: string): PosProvider {
    const provider = this.byCode.get(code);
    if (!provider) {
      throw new BadRequestException(
        `Proveedor POS desconocido: ${code}. Opciones: ${[...this.byCode.keys()].join(', ')}.`,
      );
    }
    return provider;
  }
}
