/**
 * Funcionario – Entidad de dominio
 */
export enum RolFuncionario {
  ADMINISTRADOR = 'ADMINISTRADOR',
  RECEPCIONISTA = 'RECEPCIONISTA',
  PERSONAL_LIMPIEZA = 'PERSONAL_LIMPIEZA',
}

export class Funcionario {
  constructor(
    public readonly id: number,
    public readonly sedeId: number,
    public readonly rut: string,
    public readonly nombres: string,
    public readonly apellidos: string,
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly rol: RolFuncionario,
  ) {}
}
