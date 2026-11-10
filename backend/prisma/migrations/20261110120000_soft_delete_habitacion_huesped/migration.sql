-- Soft delete de habitaciones: quedan inactivas en vez de borrarse.
ALTER TABLE `habitacion` ADD COLUMN `activa` BOOLEAN NOT NULL DEFAULT true;

-- Huéspedes eliminados: se anonimizan y se marca la fecha, conservando su historial de reservas.
ALTER TABLE `huesped` ADD COLUMN `eliminadoEn` DATETIME(3) NULL;
