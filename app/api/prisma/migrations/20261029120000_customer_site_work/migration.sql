-- CreateTable
CREATE TABLE `CustomerSiteWork` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `customerId` INTEGER NOT NULL,
    `mineId` INTEGER NOT NULL,
    `clusterNumber` VARCHAR(50) NOT NULL,
    `wellId` INTEGER NOT NULL,
    `startsAt` DATE NOT NULL,
    `expectedEndAt` DATE NOT NULL,
    `supervisorEmployeeId` INTEGER NOT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `CustomerSiteWork_mineId_startsAt_expectedEndAt_idx`(`mineId`, `startsAt`, `expectedEndAt`),
    INDEX `CustomerSiteWork_wellId_startsAt_expectedEndAt_idx`(`wellId`, `startsAt`, `expectedEndAt`),
    INDEX `CustomerSiteWork_supervisorEmployeeId_startsAt_expectedEndAt_idx`(`supervisorEmployeeId`, `startsAt`, `expectedEndAt`),
    INDEX `CustomerSiteWork_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CustomerSiteWork` ADD CONSTRAINT `CustomerSiteWork_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustomerSiteWork` ADD CONSTRAINT `CustomerSiteWork_mineId_fkey` FOREIGN KEY (`mineId`) REFERENCES `Mine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustomerSiteWork` ADD CONSTRAINT `CustomerSiteWork_wellId_fkey` FOREIGN KEY (`wellId`) REFERENCES `Well`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustomerSiteWork` ADD CONSTRAINT `CustomerSiteWork_supervisorEmployeeId_fkey` FOREIGN KEY (`supervisorEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CustomerSiteWork` ADD CONSTRAINT `CustomerSiteWork_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
