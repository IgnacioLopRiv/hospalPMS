import { Huesped } from '../entities/huesped.entity';

/**
 * Puerto de repositorio para Huesped (dominio → infraestructura)
 */
export abstract class HuespedRepository {
  abstract findAll(): Promise<Huesped[]>;
  abstract findById(id: number): Promise<Huesped | null>;
  abstract findByRutPasaporte(rutPasaporte: string): Promise<Huesped | null>;
  abstract create(data: {
    rutPasaporte: string;
    nombres: string;
    apellidos: string;
    paisResidencia: string;
    telefono: string;
    email: string;
  }): Promise<Huesped>;
  abstract update(
    id: number,
    data: Partial<{
      rutPasaporte: string;
      nombres: string;
      apellidos: string;
      paisResidencia: string;
      telefono: string;
      email: string;
    }>,
  ): Promise<Huesped>;
  abstract delete(id: number): Promise<void>;
}
