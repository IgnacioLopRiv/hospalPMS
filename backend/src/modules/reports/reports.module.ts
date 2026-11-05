import { Module } from '@nestjs/common';
import { ReportesController } from './infrastructure/controllers/reportes.controller';

@Module({
  controllers: [ReportesController],
})
export class ReportsModule {}
