CREATE TABLE `WorkScheduleInterval` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `status` ENUM('WORK', 'FREE_SHIFT', 'TRAVEL', 'SICK_LEAVE', 'VACATION', 'TRAINING') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `WorkScheduleInterval_userId_startDate_endDate_idx`(`userId`, `startDate`, `endDate`),
    INDEX `WorkScheduleInterval_startDate_endDate_idx`(`startDate`, `endDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `WorkScheduleInterval` ADD CONSTRAINT `WorkScheduleInterval_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
