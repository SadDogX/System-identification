-- AlterTable
ALTER TABLE `UserSystemRole` ADD COLUMN `globalRoleKey` VARCHAR(50) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `UserSystemRole_globalRoleKey_key` ON `UserSystemRole`(`globalRoleKey`);
