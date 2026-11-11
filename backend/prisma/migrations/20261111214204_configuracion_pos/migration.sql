-- CreateTable
CREATE TABLE `configuracion_pos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sedeId` INTEGER NOT NULL,
    `proveedor` VARCHAR(50) NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT false,
    `credenciales` TEXT NULL,
    `parametros` JSON NULL,
    `creadoAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `configuracion_pos_sedeId_key`(`sedeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `configuracion_pos` ADD CONSTRAINT `configuracion_pos_sedeId_fkey` FOREIGN KEY (`sedeId`) REFERENCES `sede`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
