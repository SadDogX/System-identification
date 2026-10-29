-- AlterTable
ALTER TABLE `Well` ADD COLUMN `clusterNumber` VARCHAR(50) NULL;

-- CreateTable
CREATE TABLE `WorkAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `baseId` INTEGER NOT NULL,
    `mineId` INTEGER NULL,
    `wellId` INTEGER NULL,
    `locationType` ENUM('BASE', 'CLUSTER', 'WELL') NOT NULL,
    `clusterNumber` VARCHAR(50) NULL,
    `workTypeId` INTEGER NOT NULL,
    `statusId` INTEGER NOT NULL,
    `startsAt` DATE NOT NULL,
    `endsAt` DATE NOT NULL,
    `description` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkAssignment_baseId_startsAt_endsAt_idx`(`baseId`, `startsAt`, `endsAt`),
    INDEX `WorkAssignment_mineId_startsAt_endsAt_idx`(`mineId`, `startsAt`, `endsAt`),
    INDEX `WorkAssignment_wellId_startsAt_endsAt_idx`(`wellId`, `startsAt`, `endsAt`),
    INDEX `WorkAssignment_workTypeId_startsAt_idx`(`workTypeId`, `startsAt`),
    INDEX `WorkAssignment_statusId_startsAt_idx`(`statusId`, `startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkAssignmentResponsible` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workAssignmentId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,

    UNIQUE INDEX `WorkAssignmentResponsible_workAssignmentId_employeeId_key`(`workAssignmentId`, `employeeId`),
    INDEX `WorkAssignmentResponsible_employeeId_workAssignmentId_idx`(`employeeId`, `workAssignmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WorkAssignment` ADD CONSTRAINT `WorkAssignment_baseId_fkey` FOREIGN KEY (`baseId`) REFERENCES `Base`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WorkAssignment` ADD CONSTRAINT `WorkAssignment_mineId_fkey` FOREIGN KEY (`mineId`) REFERENCES `Mine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WorkAssignment` ADD CONSTRAINT `WorkAssignment_wellId_fkey` FOREIGN KEY (`wellId`) REFERENCES `Well`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WorkAssignment` ADD CONSTRAINT `WorkAssignment_workTypeId_fkey` FOREIGN KEY (`workTypeId`) REFERENCES `WorkType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WorkAssignment` ADD CONSTRAINT `WorkAssignment_statusId_fkey` FOREIGN KEY (`statusId`) REFERENCES `WorkStatus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WorkAssignment` ADD CONSTRAINT `WorkAssignment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `WorkAssignmentResponsible` ADD CONSTRAINT `WorkAssignmentResponsible_workAssignmentId_fkey` FOREIGN KEY (`workAssignmentId`) REFERENCES `WorkAssignment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WorkAssignmentResponsible` ADD CONSTRAINT `WorkAssignmentResponsible_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
