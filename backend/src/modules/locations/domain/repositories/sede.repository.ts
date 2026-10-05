import { Sede } from '../entities/sede.entity';

/**
 * Puerto de repositorio para Sede (dominio → infraestructura)
 *
 * Define el contrato que la capa de infraestructura debe cumplir.
 * Permite intercambiar la implementación sin afectar la lógica de negocio.
 */
export abstract class SedeRepository {
  abstract findAll(): Promise<Sede[]>;
  abstract findById(id: number): Promise<Sede | null>;
  abstract create(data: { nombre: string; ciudad: string }): Promise<Sede>;
  abstract update(id: number, data: Partial<{ nombre: string; ciudad: string }>): Promise<Sede>;
  abstract delete(id: number): Promise<void>;
}
