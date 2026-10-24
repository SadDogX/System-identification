-- CreateTable
CREATE TABLE `WorkScheduleEntry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `status` ENUM('WORK', 'FREE_SHIFT', 'TRAVEL', 'SICK_LEAVE', 'VACATION', 'TRAINING') NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkScheduleEntry_date_idx`(`date`),
    UNIQUE INDEX `WorkScheduleEntry_userId_date_key`(`userId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WorkScheduleEntry` ADD CONSTRAINT `WorkScheduleEntry_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
