-- Уведомления: скрытие из списка
ALTER TABLE `Notification` ADD COLUMN `dismissedAt` DATETIME(3) NULL;

-- Фото удостоверения
ALTER TABLE `UserCredential` ADD COLUMN `photoFile` VARCHAR(100) NULL,
    ADD COLUMN `photoMime` VARCHAR(50) NULL;

-- Справочник должностей
CREATE TABLE `Position` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isArchived` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Position_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `User` ADD COLUMN `positionId` INTEGER NULL;

-- Перенос уже введённых должностей в справочник
INSERT INTO `Position` (`name`, `updatedAt`)
    SELECT DISTINCT TRIM(`position`), CURRENT_TIMESTAMP(3)
    FROM `User`
    WHERE `position` IS NOT NULL AND TRIM(`position`) <> '';

UPDATE `User` u JOIN `Position` p ON p.`name` = TRIM(u.`position`)
    SET u.`positionId` = p.`id`;

ALTER TABLE `User` DROP COLUMN `position`;

ALTER TABLE `User` ADD CONSTRAINT `User_positionId_fkey` FOREIGN KEY (`positionId`) REFERENCES `Position`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
