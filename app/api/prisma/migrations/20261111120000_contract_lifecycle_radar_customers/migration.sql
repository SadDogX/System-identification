CREATE TABLE `ContractDocument` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `storedFile` VARCHAR(255) NOT NULL,
    `mime` VARCHAR(50) NOT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `ContractDocument_contractId_createdAt_idx`(`contractId`, `createdAt`),
    UNIQUE INDEX `ContractDocument_storedFile_key`(`storedFile`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ContractDocument` ADD CONSTRAINT `ContractDocument_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ContractDocument` ADD CONSTRAINT `ContractDocument_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `RadarCard` ADD COLUMN `customerId` INTEGER NULL;
CREATE INDEX `RadarCard_customerId_idx` ON `RadarCard`(`customerId`);
UPDATE `RadarCard` r
JOIN (
    SELECT MIN(`name`) AS `name`, MIN(`id`) AS `id`
    FROM `Customer`
    WHERE `isActive` = TRUE
    GROUP BY BINARY `name`
    HAVING COUNT(*) = 1
) c ON BINARY c.`name` = BINARY r.`customerName`
SET r.`customerId` = c.`id`;
ALTER TABLE `RadarCard` ADD CONSTRAINT `RadarCard_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
