import { Hostal } from '../entities/hostal.entity';

export interface HostalData {
  rutEmpresa: string;
  razonSocial: string;
  nombreFantasia: string;
  giro: string;
  direccion: string;
  logoUrl?: string | null;
}

/**
 * Puerto abstracto de repositorio para Hostal – Domain layer
 *
 * Define el contrato que la infraestructura debe cumplir.
 * La capa de aplicación depende de esta abstracción, no de Prisma.
 */
export abstract class HostalRepository {
  abstract findFirst(): Promise<Hostal | null>;
  abstract findAll(): Promise<Hostal[]>;
  abstract findById(id: number): Promise<Hostal | null>;
  abstract create(data: HostalData): Promise<Hostal>;
  abstract update(id: number, data: Partial<HostalData>): Promise<Hostal>;
  abstract delete(id: number): Promise<void>;
}
