ALTER TABLE `tipologia`
  ADD COLUMN `color` VARCHAR(7) NULL,
  ADD COLUMN `precioBase` INTEGER NULL;

ALTER TABLE `habitacion`
  ADD COLUMN `tamanoM2` DOUBLE NULL,
  ADD COLUMN `disposicionMuebles` VARCHAR(191) NULL,
  ADD COLUMN `descripcion` TEXT NULL,
  ADD COLUMN `huespedActual` VARCHAR(191) NULL,
  ADD COLUMN `aseoIniciado` DATETIME(3) NULL;

CREATE TABLE `configuracion_tarifa` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `sedeId` INTEGER NOT NULL,
  `porcentajeAbono` INTEGER NOT NULL DEFAULT 20,
  `tarifas` JSON NOT NULL,
  UNIQUE INDEX `configuracion_tarifa_sedeId_key` (`sedeId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `configuracion_tarifa_sedeId_fkey` FOREIGN KEY (`sedeId`) REFERENCES `sede`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;