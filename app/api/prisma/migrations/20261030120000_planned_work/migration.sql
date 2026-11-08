-- Planned work calendar entries and their assigned employees.
CREATE TABLE `PlannedWork` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `baseId` INTEGER NOT NULL,
    `mineId` INTEGER NOT NULL,
    `clusterNumber` VARCHAR(50) NOT NULL,
    `wellId` INTEGER NULL,
    `name` VARCHAR(200) NOT NULL,
    `startsAt` DATE NOT NULL,
    `endsAt` DATE NOT NULL,
    `coordinatorEmployeeId` INTEGER NOT NULL,
    `supervisorEmployeeId` INTEGER NOT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `PlannedWork_baseId_startsAt_endsAt_idx`(`baseId`, `startsAt`, `endsAt`),
    INDEX `PlannedWork_baseId_clusterNumber_startsAt_idx`(`baseId`, `clusterNumber`, `startsAt`),
    INDEX `PlannedWork_mineId_startsAt_endsAt_idx`(`mineId`, `startsAt`, `endsAt`),
    INDEX `PlannedWork_wellId_idx`(`wellId`),
    INDEX `PlannedWork_coordinatorEmployeeId_idx`(`coordinatorEmployeeId`),
    INDEX `PlannedWork_supervisorEmployeeId_idx`(`supervisorEmployeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PlannedWorkEmployee` (
    `plannedWorkId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,
    PRIMARY KEY (`plannedWorkId`, `employeeId`),
    INDEX `PlannedWorkEmployee_employeeId_plannedWorkId_idx`(`employeeId`, `plannedWorkId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PlannedWork` ADD CONSTRAINT `PlannedWork_baseId_fkey` FOREIGN KEY (`baseId`) REFERENCES `Base`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PlannedWork` ADD CONSTRAINT `PlannedWork_mineId_fkey` FOREIGN KEY (`mineId`) REFERENCES `Mine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PlannedWork` ADD CONSTRAINT `PlannedWork_wellId_fkey` FOREIGN KEY (`wellId`) REFERENCES `Well`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PlannedWork` ADD CONSTRAINT `PlannedWork_coordinatorEmployeeId_fkey` FOREIGN KEY (`coordinatorEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PlannedWork` ADD CONSTRAINT `PlannedWork_supervisorEmployeeId_fkey` FOREIGN KEY (`supervisorEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PlannedWork` ADD CONSTRAINT `PlannedWork_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `PlannedWorkEmployee` ADD CONSTRAINT `PlannedWorkEmployee_plannedWorkId_fkey` FOREIGN KEY (`plannedWorkId`) REFERENCES `PlannedWork`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PlannedWorkEmployee` ADD CONSTRAINT `PlannedWorkEmployee_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
