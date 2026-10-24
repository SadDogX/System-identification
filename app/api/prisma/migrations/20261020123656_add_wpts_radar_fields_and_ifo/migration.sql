/*
  Warnings:

  - Added the required column `customerName` to the `RadarCard` table without a default value. This is not possible if the table is not empty.

*/
ALTER TABLE `RadarCard` ADD COLUMN `customerName` VARCHAR(200) NOT NULL DEFAULT 'Заказчик не указан',
    ADD COLUMN `stoppedWork` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `RadarCard` ALTER COLUMN `customerName` DROP DEFAULT;

-- CreateTable
CREATE TABLE `IfoProposal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `proposerId` INTEGER NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `problem` TEXT NOT NULL,
    `proposal` TEXT NOT NULL,
    `expectedBenefit` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `IfoProposal_createdAt_idx`(`createdAt`),
    INDEX `IfoProposal_proposerId_createdAt_idx`(`proposerId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `IfoProposal` ADD CONSTRAINT `IfoProposal_proposerId_fkey` FOREIGN KEY (`proposerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
