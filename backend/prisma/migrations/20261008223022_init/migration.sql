-- CreateTable
CREATE TABLE `hostal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rutEmpresa` VARCHAR(12) NOT NULL,
    `razonSocial` VARCHAR(191) NOT NULL,
    `nombreFantasia` VARCHAR(191) NOT NULL,
    `giro` VARCHAR(191) NOT NULL,
    `direccion` VARCHAR(191) NOT NULL,
    `logoUrl` VARCHAR(500) NULL,

    UNIQUE INDEX `hostal_rutEmpresa_key`(`rutEmpresa`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sede` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `hostalId` INTEGER NOT NULL,
    `nombreSede` VARCHAR(191) NOT NULL,
    `direccion` VARCHAR(191) NOT NULL,
    `ciudad` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(20) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `funcionario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sedeId` INTEGER NOT NULL,
    `rut` VARCHAR(12) NOT NULL,
    `nombres` VARCHAR(191) NOT NULL,
    `apellidos` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `rol` ENUM('ADMINISTRADOR', 'RECEPCIONISTA', 'PERSONAL_LIMPIEZA') NOT NULL,

    UNIQUE INDEX `funcionario_rut_key`(`rut`),
    UNIQUE INDEX `funcionario_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tipologia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sedeId` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `capacidadMax` INTEGER NOT NULL,
    `numCamas` INTEGER NOT NULL,
    `descripcion` TEXT NULL,

    UNIQUE INDEX `tipologia_sedeId_nombre_key`(`sedeId`, `nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `caracteristica` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `icono` VARCHAR(191) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tipologia_caracteristica` (
    `tipologiaId` INTEGER NOT NULL,
    `caracteristicaId` INTEGER NOT NULL,

    PRIMARY KEY (`tipologiaId`, `caracteristicaId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tarifa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipologiaId` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `precioBase` INTEGER NOT NULL,
    `fechaInicio` DATE NOT NULL,
    `fechaFin` DATE NOT NULL,
    `tipoTemporada` ENUM('ALTA', 'BAJA') NOT NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,

    INDEX `tarifa_tipologiaId_fechaInicio_fechaFin_idx`(`tipologiaId`, `fechaInicio`, `fechaFin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `habitacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sedeId` INTEGER NOT NULL,
    `tipologiaId` INTEGER NOT NULL,
    `numero` VARCHAR(10) NOT NULL,
    `estado` ENUM('DISPONIBLE', 'RESERVADA', 'OCUPADA', 'EN_LIMPIEZA', 'MANTENIMIENTO') NOT NULL DEFAULT 'DISPONIBLE',
    `cantidadPersonas` INTEGER NOT NULL,

    UNIQUE INDEX `habitacion_sedeId_numero_key`(`sedeId`, `numero`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `insumo_inventario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sedeId` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `costoCompra` INTEGER NOT NULL,
    `stockActual` INTEGER NOT NULL,
    `stockMinimo` INTEGER NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventario_habitacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `insumoId` INTEGER NOT NULL,
    `habitacionId` INTEGER NOT NULL,
    `cantidad` INTEGER NOT NULL,
    `estado` VARCHAR(30) NOT NULL,
    `fechaAsignacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `huesped` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rutPasaporte` VARCHAR(20) NOT NULL,
    `nombres` VARCHAR(191) NOT NULL,
    `apellidos` VARCHAR(191) NOT NULL,
    `paisResidencia` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(20) NOT NULL,

    UNIQUE INDEX `huesped_rutPasaporte_key`(`rutPasaporte`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reserva` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `huespedId` INTEGER NOT NULL,
    `habitacionId` INTEGER NOT NULL,
    `fechaReserva` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaCheckIn` DATETIME(3) NOT NULL,
    `fechaCheckOut` DATETIME(3) NOT NULL,
    `estado` ENUM('CONFIRMADA', 'EN_CURSO', 'FINALIZADA', 'CANCELADA') NOT NULL DEFAULT 'CONFIRMADA',

    INDEX `reserva_habitacionId_fechaCheckIn_fechaCheckOut_idx`(`habitacionId`, `fechaCheckIn`, `fechaCheckOut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pago` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reservaId` INTEGER NOT NULL,
    `monto` INTEGER NOT NULL,
    `metodoPago` ENUM('TRANSFERENCIA', 'EFECTIVO', 'TARJETA_CREDITO', 'TARJETA_DEBITO') NOT NULL,
    `tipoOperacion` ENUM('ABONO', 'PAGO_FINAL', 'PAGO_SERVICIO_ADICIONAL', 'REEMBOLSO') NOT NULL,
    `fechaPago` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documento_facturacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reservaId` INTEGER NOT NULL,
    `tipoDocumento` ENUM('BOLETA', 'FACTURA', 'NOTA_CREDITO') NOT NULL,
    `folioSii` INTEGER NULL,
    `montoNeto` INTEGER NOT NULL,
    `montoIva` INTEGER NOT NULL,
    `montoTotal` INTEGER NOT NULL,
    `fechaEmision` DATETIME(3) NOT NULL,
    `estadoSii` ENUM('PENDIENTE', 'ENVIADO', 'ACEPTADO', 'RECHAZADO') NOT NULL DEFAULT 'PENDIENTE',

    UNIQUE INDEX `documento_facturacion_tipoDocumento_folioSii_key`(`tipoDocumento`, `folioSii`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sede` ADD CONSTRAINT `sede_hostalId_fkey` FOREIGN KEY (`hostalId`) REFERENCES `hostal`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `funcionario` ADD CONSTRAINT `funcionario_sedeId_fkey` FOREIGN KEY (`sedeId`) REFERENCES `sede`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tipologia` ADD CONSTRAINT `tipologia_sedeId_fkey` FOREIGN KEY (`sedeId`) REFERENCES `sede`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tipologia_caracteristica` ADD CONSTRAINT `tipologia_caracteristica_tipologiaId_fkey` FOREIGN KEY (`tipologiaId`) REFERENCES `tipologia`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tipologia_caracteristica` ADD CONSTRAINT `tipologia_caracteristica_caracteristicaId_fkey` FOREIGN KEY (`caracteristicaId`) REFERENCES `caracteristica`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tarifa` ADD CONSTRAINT `tarifa_tipologiaId_fkey` FOREIGN KEY (`tipologiaId`) REFERENCES `tipologia`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `habitacion` ADD CONSTRAINT `habitacion_sedeId_fkey` FOREIGN KEY (`sedeId`) REFERENCES `sede`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `habitacion` ADD CONSTRAINT `habitacion_tipologiaId_fkey` FOREIGN KEY (`tipologiaId`) REFERENCES `tipologia`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `insumo_inventario` ADD CONSTRAINT `insumo_inventario_sedeId_fkey` FOREIGN KEY (`sedeId`) REFERENCES `sede`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventario_habitacion` ADD CONSTRAINT `inventario_habitacion_insumoId_fkey` FOREIGN KEY (`insumoId`) REFERENCES `insumo_inventario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventario_habitacion` ADD CONSTRAINT `inventario_habitacion_habitacionId_fkey` FOREIGN KEY (`habitacionId`) REFERENCES `habitacion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reserva` ADD CONSTRAINT `reserva_huespedId_fkey` FOREIGN KEY (`huespedId`) REFERENCES `huesped`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reserva` ADD CONSTRAINT `reserva_habitacionId_fkey` FOREIGN KEY (`habitacionId`) REFERENCES `habitacion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pago` ADD CONSTRAINT `pago_reservaId_fkey` FOREIGN KEY (`reservaId`) REFERENCES `reserva`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documento_facturacion` ADD CONSTRAINT `documento_facturacion_reservaId_fkey` FOREIGN KEY (`reservaId`) REFERENCES `reserva`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
