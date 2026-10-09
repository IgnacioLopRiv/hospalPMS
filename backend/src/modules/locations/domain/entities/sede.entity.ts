/**
 * Entidad de dominio: Sede
 *
 * Representa una propiedad/hostal dentro del sistema.
 * No depende de Prisma ni de ninguna tecnología de infraestructura.
 */
export class Sede {
  constructor(
    public readonly id: number,
    public readonly hostalId: number,
    public nombreSede: string,
    public direccion: string,
    public ciudad: string,
    public telefono: string | null,
  ) {}
}
