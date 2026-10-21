import { Module } from '@nestjs/common';
import { SedeRepository } from './domain/repositories/sede.repository';
import { TipologiaRepository } from './domain/repositories/tipologia.repository';
import { HabitacionRepository } from './domain/repositories/habitacion.repository';
import { PrismaSedeRepository } from './infrastructure/repositories/prisma-sede.repository';
import { PrismaTipologiaRepository } from './infrastructure/repositories/prisma-tipologia.repository';
import { PrismaHabitacionRepository } from './infrastructure/repositories/prisma-habitacion.repository';
import { GetSedesUseCase } from './application/use-cases/get-sedes.use-case';
import { CreateSedeUseCase } from './application/use-cases/create-sede.use-case';
import { UpdateSedeUseCase } from './application/use-cases/update-sede.use-case';
import { DeleteSedeUseCase } from './application/use-cases/delete-sede.use-case';
import { SedesController } from './infrastructure/controllers/sedes.controller';
import { TipologiasController } from './infrastructure/controllers/tipologias.controller';
import { CaracteristicasController } from './infrastructure/controllers/caracteristicas.controller';
import { TarifasController } from './infrastructure/controllers/tarifas.controller';
import { HabitacionesController } from './infrastructure/controllers/habitaciones.controller';

const USE_CASES = [
  GetSedesUseCase,
  CreateSedeUseCase,
  UpdateSedeUseCase,
  DeleteSedeUseCase,
];

/**
 * LocationsModule – Feature module
 *
 * Conecta repositorios abstractos (dominio) con implementaciones concretas
 * (infraestructura Prisma) mediante inyección de dependencias de NestJS.
 */
@Module({
  controllers: [
    SedesController,
    TipologiasController,
    CaracteristicasController,
    TarifasController,
    HabitacionesController,
  ],
  providers: [
    // Implementaciones de repositorios (adaptadores de infraestructura)
    { provide: SedeRepository, useClass: PrismaSedeRepository },
    { provide: TipologiaRepository, useClass: PrismaTipologiaRepository },
    { provide: HabitacionRepository, useClass: PrismaHabitacionRepository },
    // Use cases (capa de aplicación)
    ...USE_CASES,
  ],
  exports: [...USE_CASES],
})
export class LocationsModule {}
