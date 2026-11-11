export interface PosConfigRecord {
  sedeId: number;
  proveedor: string;
  activo: boolean;
  /** Credenciales cifradas (o null si no hay). */
  credenciales: string | null;
  parametros: Record<string, unknown>;
  actualizadoAt: Date;
}

export interface PosConfigUpsert {
  proveedor: string;
  activo: boolean;
  credenciales: string | null;
  parametros: Record<string, unknown>;
}

export abstract class PosConfigRepository {
  abstract sedeExists(sedeId: number): Promise<boolean>;
  abstract findBySede(sedeId: number): Promise<PosConfigRecord | null>;
  abstract upsert(
    sedeId: number,
    data: PosConfigUpsert,
  ): Promise<PosConfigRecord>;
}
