import { Module } from '@nestjs/common';
import { FuncionarioRepository } from './domain/repositories/funcionario.repository';
import { PrismaFuncionarioRepository } from './infrastructure/repositories/prisma-funcionario.repository';
import { FuncionariosController } from './infrastructure/controllers/funcionarios.controller';

/**
 * StaffModule – Feature module para Funcionarios
 */
@Module({
  controllers: [FuncionariosController],
  providers: [
    { provide: FuncionarioRepository, useClass: PrismaFuncionarioRepository },
  ],
  exports: [FuncionarioRepository],
})
export class StaffModule {}
