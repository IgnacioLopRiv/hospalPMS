import { Module } from '@nestjs/common';
import { InventarioItemRepository } from './domain/repositories/inventario-item.repository';
import { PrismaInventarioItemRepository } from './infrastructure/repositories/prisma-inventario-item.repository';

/**
 * InventoryModule – Feature module
 */
@Module({
  providers: [
    {
      provide: InventarioItemRepository,
      useClass: PrismaInventarioItemRepository,
    },
    // Use cases se agregarán aquí
  ],
  exports: [InventarioItemRepository],
})
export class InventoryModule {}
