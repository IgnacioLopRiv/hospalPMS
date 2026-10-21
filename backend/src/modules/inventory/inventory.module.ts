import { Module } from '@nestjs/common';
import { InsumoInventarioRepository } from './domain/repositories/insumo-inventario.repository';
import { InventarioHabitacionRepository } from './domain/repositories/inventario-habitacion.repository';
import { PrismaInsumoInventarioRepository } from './infrastructure/repositories/prisma-insumo-inventario.repository';
import { PrismaInventarioHabitacionRepository } from './infrastructure/repositories/prisma-inventario-habitacion.repository';
import { InventarioController } from './infrastructure/controllers/inventario.controller';

/**
 * InventoryModule – Feature module
 */
@Module({
  controllers: [InventarioController],
  providers: [
    { provide: InsumoInventarioRepository, useClass: PrismaInsumoInventarioRepository },
    {
      provide: InventarioHabitacionRepository,
      useClass: PrismaInventarioHabitacionRepository,
    },
    // Use cases se agregarán aquí
  ],
  exports: [InsumoInventarioRepository, InventarioHabitacionRepository],
})
export class InventoryModule {}
