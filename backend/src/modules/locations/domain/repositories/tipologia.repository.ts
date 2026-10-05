import { Tipologia } from '../entities/tipologia.entity';

/**
 * Puerto de repositorio para Tipologia (dominio → infraestructura)
 */
export abstract class TipologiaRepository {
  abstract findBySedeId(sedeId: number): Promise<Tipologia[]>;
  abstract findById(id: number): Promise<Tipologia | null>;
  abstract create(data: {
    sedeId: number;
    nombre: string;
    capacidad: number;
    color?: string;
    precioBase?: number;
    descripcion?: string;
  }): Promise<Tipologia>;
  abstract update(
    id: number,
    data: Partial<{
      nombre: string;
      capacidad: number;
      color: string;
      precioBase: number;
      descripcion: string;
    }>,
  ): Promise<Tipologia>;
  abstract delete(id: number): Promise<void>;
}
