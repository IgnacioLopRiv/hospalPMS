/**
 * Entidad de dominio: Reserva
 */
export enum EstadoReserva {
  HOSPEDADO = 'HOSPEDADO',
  CHECK_IN_HOY = 'CHECK_IN_HOY',
  CHECK_OUT_HOY = 'CHECK_OUT_HOY',
  CONFIRMADA = 'CONFIRMADA',
}

export class Reserva {
  constructor(
    public readonly id: number,
    public readonly huespedId: number,
    public readonly habitacionId: number,
    public fechaLlegada: Date,
    public fechaSalida: Date,
    public horaLlegada: string | null,
    public cantidadPersonas: number | null,
    public estado: EstadoReserva,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  get duracionNoches(): number {
    const diff = this.fechaSalida.getTime() - this.fechaLlegada.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}
