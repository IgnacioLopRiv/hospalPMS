import { Hostal } from '../entities/hostal.entity';

export interface HostalData {
  rutEmpresa: string;
  razonSocial: string;
  nombreFantasia: string;
  giro: string;
  direccion: string;
  logoUrl?: string | null;
}

export abstract class HostalRepository {
  abstract findAll(): Promise<Hostal[]>;
  abstract findById(id: number): Promise<Hostal | null>;
  abstract create(data: HostalData): Promise<Hostal>;
  abstract update(id: number, data: Partial<HostalData>): Promise<Hostal>;
  abstract delete(id: number): Promise<void>;
}