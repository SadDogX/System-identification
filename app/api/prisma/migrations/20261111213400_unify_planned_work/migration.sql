INSERT INTO `WorkStatus` (`code`, `name`, `sortOrder`, `createdAt`, `updatedAt`)
SELECT 'PLANNED', 'Запланирована', 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (SELECT 1 FROM `WorkStatus` WHERE `code` = 'PLANNED');

ALTER TABLE `PlannedWork`
    MODIFY `mineId` INTEGER NULL,
    MODIFY `clusterNumber` VARCHAR(50) NULL,
    ADD COLUMN `locationType` ENUM('BASE', 'CLUSTER', 'WELL') NOT NULL DEFAULT 'WELL',
    ADD COLUMN `workTypeId` INTEGER NULL,
    ADD COLUMN `statusId` INTEGER NULL,
    ADD COLUMN `description` TEXT NULL;

UPDATE `PlannedWork`
SET `locationType` = IF(`wellId` IS NULL, 'CLUSTER', 'WELL'),
    `statusId` = (SELECT `id` FROM `WorkStatus` WHERE `code` = 'PLANNED');

ALTER TABLE `PlannedWork`
    MODIFY `statusId` INTEGER NOT NULL,
    ADD INDEX `PlannedWork_workTypeId_startsAt_idx`(`workTypeId`, `startsAt`),
    ADD INDEX `PlannedWork_statusId_startsAt_idx`(`statusId`, `startsAt`),
    ADD CONSTRAINT `PlannedWork_workTypeId_fkey` FOREIGN KEY (`workTypeId`) REFERENCES `WorkType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `PlannedWork_statusId_fkey` FOREIGN KEY (`statusId`) REFERENCES `WorkStatus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE `WorkAssignmentResponsible`;
DROP TABLE `WorkAssignment`;
