/**
 * Entidad de dominio: Reserva
 */
export enum EstadoReserva {
  CONFIRMADA = 'CONFIRMADA',
  EN_CURSO = 'EN_CURSO',
  FINALIZADA = 'FINALIZADA',
  CANCELADA = 'CANCELADA',
}

export class Reserva {
  constructor(
    public readonly id: number,
    public readonly huespedId: number,
    public readonly habitacionId: number,
    public readonly fechaReserva: Date,
    public fechaCheckIn: Date,
    public fechaCheckOut: Date,
    public estado: EstadoReserva,
  ) {}

  get duracionNoches(): number {
    const diff = this.fechaCheckOut.getTime() - this.fechaCheckIn.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}
