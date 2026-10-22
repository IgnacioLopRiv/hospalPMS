import { Funcionario, RolFuncionario } from '../entities/funcionario.entity';

/**
 * Puerto abstracto de repositorio para Funcionario – Domain layer
 */
export abstract class FuncionarioRepository {
  abstract findAll(): Promise<Funcionario[]>;
  abstract findBySedeId(sedeId: number): Promise<Funcionario[]>;
  abstract findById(id: number): Promise<Funcionario | null>;
  abstract create(data: {
    sedeId: number;
    rut: string;
    nombres: string;
    apellidos: string;
    email: string;
    passwordHash: string;
    rol: RolFuncionario;
  }): Promise<Funcionario>;
  abstract update(
    id: number,
    data: Partial<{
      nombres: string;
      apellidos: string;
      email: string;
      passwordHash: string;
      rol: RolFuncionario;
    }>,
  ): Promise<Funcionario>;
  abstract delete(id: number): Promise<void>;
}
