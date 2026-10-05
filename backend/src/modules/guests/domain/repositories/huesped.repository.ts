import { Huesped } from '../entities/huesped.entity';

/**
 * Puerto de repositorio para Huesped (dominio → infraestructura)
 */
export abstract class HuespedRepository {
  abstract findAll(): Promise<Huesped[]>;
  abstract findById(id: number): Promise<Huesped | null>;
  abstract findByEmail(email: string): Promise<Huesped | null>;
  abstract create(data: {
    documento?: string;
    nombre: string;
    apellido: string;
    nacionalidad: string;
    telefono: string;
    email: string;
    esRecurrente?: boolean;
  }): Promise<Huesped>;
  abstract update(
    id: number,
    data: Partial<{
      documento: string;
      nombre: string;
      apellido: string;
      nacionalidad: string;
      telefono: string;
      email: string;
      esRecurrente: boolean;
    }>,
  ): Promise<Huesped>;
  abstract delete(id: number): Promise<void>;
}
