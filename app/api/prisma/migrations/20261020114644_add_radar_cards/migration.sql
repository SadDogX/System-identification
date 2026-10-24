-- CreateTable
CREATE TABLE `RadarCard` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `mainInfo` TEXT NOT NULL,
    `event` TEXT NOT NULL,
    `actionsTaken` TEXT NOT NULL,
    `incidentDate` DATE NOT NULL,
    `requiredActions` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RadarCard_incidentDate_idx`(`incidentDate`),
    INDEX `RadarCard_userId_incidentDate_idx`(`userId`, `incidentDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RadarCard` ADD CONSTRAINT `RadarCard_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
