-- CreateTable
CREATE TABLE `mantenimiento_habitacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `habitacionId` INTEGER NOT NULL,
    `motivo` VARCHAR(100) NOT NULL,
    `descripcion` TEXT NULL,
    `fechaInicio` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaTermino` DATETIME(3) NULL,

    INDEX `mantenimiento_habitacion_habitacionId_fechaInicio_idx`(`habitacionId`, `fechaInicio`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `mantenimiento_habitacion` ADD CONSTRAINT `mantenimiento_habitacion_habitacionId_fkey` FOREIGN KEY (`habitacionId`) REFERENCES `habitacion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
