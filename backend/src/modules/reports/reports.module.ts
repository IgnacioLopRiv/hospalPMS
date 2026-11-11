import { Module } from '@nestjs/common';
import { ReportePdfService } from './application/reporte-pdf.service';
import { ReportesController } from './infrastructure/controllers/reportes.controller';

@Module({
  controllers: [ReportesController],
  providers: [ReportePdfService],
})
export class ReportsModule {}
