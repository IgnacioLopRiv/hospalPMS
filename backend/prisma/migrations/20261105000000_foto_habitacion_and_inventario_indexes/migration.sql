CREATE TABLE `foto_habitacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `habitacionId` INTEGER NOT NULL,
    `url` TEXT NOT NULL,
    `titulo` VARCHAR(255) NULL,
    `descripcion` TEXT NULL,
    `fechaSubida` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `foto_habitacion_habitacionId_fechaSubida_idx`(`habitacionId`, `fechaSubida`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `foto_habitacion` ADD CONSTRAINT `foto_habitacion_habitacionId_fkey` FOREIGN KEY (`habitacionId`) REFERENCES `habitacion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX `inventario_habitacion_insumoId_estado_idx` ON `inventario_habitacion`(`insumoId`, `estado`);

CREATE INDEX `inventario_habitacion_habitacionId_estado_idx` ON `inventario_habitacion`(`habitacionId`, `estado`);
