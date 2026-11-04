/**
 * Hostal – Entidad de dominio (tabla padre de la BD)
 *
 * Representa la empresa que opera uno o más hostales.
 * Sin dependencias de framework.
 */
export class Hostal {
  constructor(
    public readonly id: number,
    public readonly rutEmpresa: string,
    public readonly razonSocial: string,
    public readonly nombreFantasia: string,
    public readonly giro: string,
    public readonly direccion: string,
    public readonly logoUrl: string | null,
    public readonly email: string | null = null,
  ) {}
}
