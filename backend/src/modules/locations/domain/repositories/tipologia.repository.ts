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
    capacidadMax: number;
    numCamas: number;
    descripcion?: string | null;
    color?: string | null;
    precioBase?: number | null;
  }): Promise<Tipologia>;
  abstract update(
    id: number,
    data: Partial<{
      nombre: string;
      capacidadMax: number;
      numCamas: number;
      descripcion: string;
      color: string | null;
      precioBase: number | null;
    }>,
  ): Promise<Tipologia>;
  abstract delete(id: number): Promise<void>;
}
