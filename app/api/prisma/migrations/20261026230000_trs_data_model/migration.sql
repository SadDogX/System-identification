-- AlterTable
ALTER TABLE `Notification` MODIFY `kind` ENUM('EXPIRY', 'MESSAGE', 'DIGEST', 'ORGANIZATION') NOT NULL;

-- CreateTable
CREATE TABLE `Employee` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `employeeNumber` VARCHAR(50) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Employee_userId_key`(`userId`),
    UNIQUE INDEX `Employee_employeeNumber_key`(`employeeNumber`),
    INDEX `Employee_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Base` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `code` VARCHAR(50) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Base_name_key`(`name`),
    UNIQUE INDEX `Base_code_key`(`code`),
    INDEX `Base_isActive_name_idx`(`isActive`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssignmentStatus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AssignmentStatus_code_key`(`code`),
    INDEX `AssignmentStatus_isActive_sortOrder_idx`(`isActive`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemRole` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SystemRole_code_key`(`code`),
    INDEX `SystemRole_isActive_code_idx`(`isActive`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserSystemRole` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `systemRoleId` INTEGER NOT NULL,
    `currentUserRoleKey` VARCHAR(100) NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,
    `assignedById` INTEGER NULL,

    UNIQUE INDEX `UserSystemRole_currentUserRoleKey_key`(`currentUserRoleKey`),
    INDEX `UserSystemRole_systemRoleId_userId_idx`(`systemRoleId`, `userId`),
    INDEX `UserSystemRole_userId_revokedAt_idx`(`userId`, `revokedAt`),
    INDEX `UserSystemRole_assignedById_assignedAt_idx`(`assignedById`, `assignedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `positionId` INTEGER NULL,
    `baseId` INTEGER NULL,
    `supervisorEmployeeId` INTEGER NULL,
    `statusId` INTEGER NOT NULL,
    `track` ENUM('TRS', 'R_AND_M', 'UNASSIGNED') NOT NULL DEFAULT 'UNASSIGNED',
    `startsAt` DATE NOT NULL,
    `endsAt` DATE NULL,
    `activeEmployeeId` INTEGER NULL,
    `reason` TEXT NULL,
    `operationId` VARCHAR(36) NOT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EmployeeAssignment_activeEmployeeId_key`(`activeEmployeeId`),
    INDEX `EmployeeAssignment_employeeId_startsAt_endsAt_idx`(`employeeId`, `startsAt`, `endsAt`),
    INDEX `EmployeeAssignment_baseId_track_startsAt_endsAt_idx`(`baseId`, `track`, `startsAt`, `endsAt`),
    INDEX `EmployeeAssignment_supervisorEmployeeId_startsAt_endsAt_idx`(`supervisorEmployeeId`, `startsAt`, `endsAt`),
    INDEX `EmployeeAssignment_positionId_idx`(`positionId`),
    INDEX `EmployeeAssignment_statusId_idx`(`statusId`),
    INDEX `EmployeeAssignment_operationId_idx`(`operationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrganizationChange` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employeeId` INTEGER NOT NULL,
    `actorId` INTEGER NULL,
    `action` VARCHAR(50) NOT NULL,
    `previous` JSON NULL,
    `next` JSON NULL,
    `reason` TEXT NULL,
    `operationId` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrganizationChange_employeeId_createdAt_idx`(`employeeId`, `createdAt`),
    INDEX `OrganizationChange_actorId_createdAt_idx`(`actorId`, `createdAt`),
    INDEX `OrganizationChange_operationId_idx`(`operationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Mine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `baseId` INTEGER NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `code` VARCHAR(50) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Mine_baseId_isActive_idx`(`baseId`, `isActive`),
    UNIQUE INDEX `Mine_baseId_name_key`(`baseId`, `name`),
    UNIQUE INDEX `Mine_baseId_code_key`(`baseId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MineCoordinatorAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mineId` INTEGER NOT NULL,
    `coordinatorId` INTEGER NOT NULL,
    `currentMineId` INTEGER NULL,
    `startsAt` DATE NOT NULL,
    `endsAt` DATE NULL,
    `operationId` VARCHAR(36) NOT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MineCoordinatorAssignment_currentMineId_key`(`currentMineId`),
    INDEX `MineCoordinatorAssignment_mineId_startsAt_endsAt_idx`(`mineId`, `startsAt`, `endsAt`),
    INDEX `MineCoordinatorAssignment_coordinatorId_startsAt_endsAt_idx`(`coordinatorId`, `startsAt`, `endsAt`),
    INDEX `MineCoordinatorAssignment_operationId_idx`(`operationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Well` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mineId` INTEGER NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `code` VARCHAR(50) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Well_mineId_isActive_idx`(`mineId`, `isActive`),
    UNIQUE INDEX `Well_mineId_name_key`(`mineId`, `name`),
    UNIQUE INDEX `Well_mineId_code_key`(`mineId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `code` VARCHAR(50) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Customer_code_key`(`code`),
    INDEX `Customer_name_isActive_idx`(`name`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractStatus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `allowsWork` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ContractStatus_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contract` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customerId` INTEGER NOT NULL,
    `baseId` INTEGER NOT NULL,
    `statusId` INTEGER NOT NULL,
    `number` VARCHAR(100) NOT NULL,
    `startsAt` DATE NOT NULL,
    `endsAt` DATE NOT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Contract_customerId_statusId_idx`(`customerId`, `statusId`),
    INDEX `Contract_baseId_startsAt_endsAt_idx`(`baseId`, `startsAt`, `endsAt`),
    INDEX `Contract_statusId_startsAt_endsAt_idx`(`statusId`, `startsAt`, `endsAt`),
    UNIQUE INDEX `Contract_baseId_number_key`(`baseId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AddendumStatus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `allowsWork` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AddendumStatus_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractAddendum` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `statusId` INTEGER NOT NULL,
    `number` VARCHAR(100) NOT NULL,
    `startsAt` DATE NOT NULL,
    `endsAt` DATE NOT NULL,
    `description` TEXT NOT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ContractAddendum_contractId_startsAt_endsAt_idx`(`contractId`, `startsAt`, `endsAt`),
    INDEX `ContractAddendum_statusId_startsAt_endsAt_idx`(`statusId`, `startsAt`, `endsAt`),
    UNIQUE INDEX `ContractAddendum_contractId_number_key`(`contractId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AddendumWorkPermission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `addendumId` INTEGER NOT NULL,
    `workTypeId` INTEGER NOT NULL,
    `isAllowed` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AddendumWorkPermission_workTypeId_isAllowed_idx`(`workTypeId`, `isAllowed`),
    UNIQUE INDEX `AddendumWorkPermission_addendumId_workTypeId_key`(`addendumId`, `workTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WellContractBasis` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `wellId` INTEGER NOT NULL,
    `contractId` INTEGER NULL,
    `addendumId` INTEGER NULL,
    `currentWellId` INTEGER NULL,
    `startsAt` DATE NOT NULL,
    `endsAt` DATE NULL,
    `operationId` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WellContractBasis_currentWellId_key`(`currentWellId`),
    INDEX `WellContractBasis_wellId_startsAt_endsAt_idx`(`wellId`, `startsAt`, `endsAt`),
    INDEX `WellContractBasis_contractId_idx`(`contractId`),
    INDEX `WellContractBasis_addendumId_idx`(`addendumId`),
    INDEX `WellContractBasis_operationId_idx`(`operationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkType` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `requiresContractPermission` BOOLEAN NOT NULL DEFAULT true,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WorkType_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractWorkPermission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `workTypeId` INTEGER NOT NULL,
    `isAllowed` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ContractWorkPermission_workTypeId_isAllowed_idx`(`workTypeId`, `isAllowed`),
    UNIQUE INDEX `ContractWorkPermission_contractId_workTypeId_key`(`contractId`, `workTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkStatus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WorkStatus_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkExecution` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `wellId` INTEGER NOT NULL,
    `workTypeId` INTEGER NOT NULL,
    `contractId` INTEGER NOT NULL,
    `addendumId` INTEGER NULL,
    `statusId` INTEGER NOT NULL,
    `performedAt` DATE NOT NULL,
    `description` TEXT NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkExecution_wellId_performedAt_idx`(`wellId`, `performedAt`),
    INDEX `WorkExecution_contractId_performedAt_idx`(`contractId`, `performedAt`),
    INDEX `WorkExecution_addendumId_performedAt_idx`(`addendumId`, `performedAt`),
    INDEX `WorkExecution_workTypeId_performedAt_idx`(`workTypeId`, `performedAt`),
    INDEX `WorkExecution_statusId_performedAt_idx`(`statusId`, `performedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkExecutionResponsible` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workId` INTEGER NOT NULL,
    `employeeId` INTEGER NOT NULL,

    INDEX `WorkExecutionResponsible_employeeId_workId_idx`(`employeeId`, `workId`),
    UNIQUE INDEX `WorkExecutionResponsible_workId_employeeId_key`(`workId`, `employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Base` ADD CONSTRAINT `Base_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserSystemRole` ADD CONSTRAINT `UserSystemRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserSystemRole` ADD CONSTRAINT `UserSystemRole_systemRoleId_fkey` FOREIGN KEY (`systemRoleId`) REFERENCES `SystemRole`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserSystemRole` ADD CONSTRAINT `UserSystemRole_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeAssignment` ADD CONSTRAINT `EmployeeAssignment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeAssignment` ADD CONSTRAINT `EmployeeAssignment_positionId_fkey` FOREIGN KEY (`positionId`) REFERENCES `Position`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeAssignment` ADD CONSTRAINT `EmployeeAssignment_baseId_fkey` FOREIGN KEY (`baseId`) REFERENCES `Base`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeAssignment` ADD CONSTRAINT `EmployeeAssignment_supervisorEmployeeId_fkey` FOREIGN KEY (`supervisorEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeAssignment` ADD CONSTRAINT `EmployeeAssignment_statusId_fkey` FOREIGN KEY (`statusId`) REFERENCES `AssignmentStatus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeAssignment` ADD CONSTRAINT `EmployeeAssignment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizationChange` ADD CONSTRAINT `OrganizationChange_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizationChange` ADD CONSTRAINT `OrganizationChange_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Mine` ADD CONSTRAINT `Mine_baseId_fkey` FOREIGN KEY (`baseId`) REFERENCES `Base`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Mine` ADD CONSTRAINT `Mine_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MineCoordinatorAssignment` ADD CONSTRAINT `MineCoordinatorAssignment_mineId_fkey` FOREIGN KEY (`mineId`) REFERENCES `Mine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MineCoordinatorAssignment` ADD CONSTRAINT `MineCoordinatorAssignment_coordinatorId_fkey` FOREIGN KEY (`coordinatorId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MineCoordinatorAssignment` ADD CONSTRAINT `MineCoordinatorAssignment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Well` ADD CONSTRAINT `Well_mineId_fkey` FOREIGN KEY (`mineId`) REFERENCES `Mine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Well` ADD CONSTRAINT `Well_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_baseId_fkey` FOREIGN KEY (`baseId`) REFERENCES `Base`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_statusId_fkey` FOREIGN KEY (`statusId`) REFERENCES `ContractStatus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractAddendum` ADD CONSTRAINT `ContractAddendum_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractAddendum` ADD CONSTRAINT `ContractAddendum_statusId_fkey` FOREIGN KEY (`statusId`) REFERENCES `AddendumStatus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractAddendum` ADD CONSTRAINT `ContractAddendum_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AddendumWorkPermission` ADD CONSTRAINT `AddendumWorkPermission_addendumId_fkey` FOREIGN KEY (`addendumId`) REFERENCES `ContractAddendum`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AddendumWorkPermission` ADD CONSTRAINT `AddendumWorkPermission_workTypeId_fkey` FOREIGN KEY (`workTypeId`) REFERENCES `WorkType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WellContractBasis` ADD CONSTRAINT `WellContractBasis_wellId_fkey` FOREIGN KEY (`wellId`) REFERENCES `Well`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WellContractBasis` ADD CONSTRAINT `WellContractBasis_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WellContractBasis` ADD CONSTRAINT `WellContractBasis_addendumId_fkey` FOREIGN KEY (`addendumId`) REFERENCES `ContractAddendum`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractWorkPermission` ADD CONSTRAINT `ContractWorkPermission_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContractWorkPermission` ADD CONSTRAINT `ContractWorkPermission_workTypeId_fkey` FOREIGN KEY (`workTypeId`) REFERENCES `WorkType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkExecution` ADD CONSTRAINT `WorkExecution_wellId_fkey` FOREIGN KEY (`wellId`) REFERENCES `Well`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkExecution` ADD CONSTRAINT `WorkExecution_workTypeId_fkey` FOREIGN KEY (`workTypeId`) REFERENCES `WorkType`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkExecution` ADD CONSTRAINT `WorkExecution_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `Contract`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkExecution` ADD CONSTRAINT `WorkExecution_addendumId_fkey` FOREIGN KEY (`addendumId`) REFERENCES `ContractAddendum`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkExecution` ADD CONSTRAINT `WorkExecution_statusId_fkey` FOREIGN KEY (`statusId`) REFERENCES `WorkStatus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkExecution` ADD CONSTRAINT `WorkExecution_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkExecutionResponsible` ADD CONSTRAINT `WorkExecutionResponsible_workId_fkey` FOREIGN KEY (`workId`) REFERENCES `WorkExecution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkExecutionResponsible` ADD CONSTRAINT `WorkExecutionResponsible_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EmployeeAssignment`
    ADD CONSTRAINT `EmployeeAssignment_dates_check`
        CHECK (`endsAt` IS NULL OR `endsAt` >= `startsAt`);

ALTER TABLE `MineCoordinatorAssignment`
    ADD CONSTRAINT `MineCoordinatorAssignment_dates_check`
        CHECK (`endsAt` IS NULL OR `endsAt` >= `startsAt`);

ALTER TABLE `WellContractBasis`
    ADD CONSTRAINT `WellContractBasis_dates_check`
        CHECK (`endsAt` IS NULL OR `endsAt` >= `startsAt`);

INSERT INTO `SystemRole` (`code`, `name`, `isActive`, `createdAt`, `updatedAt`) VALUES
    ('ADMIN', 'Администратор', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('MANAGER', 'Менеджер (root)', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('COORDINATOR', 'Координатор (editor)', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('SENIOR_MECHANIC', 'Старший механик', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('MECHANIC', 'Механик', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('SHOP_FOREMAN', 'Мастер цеха', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('SHOP_EMPLOYEE', 'Сотрудник цеха', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('EMPLOYEE', 'Сотрудник', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

INSERT INTO `AssignmentStatus` (`code`, `name`, `isActive`, `sortOrder`, `createdAt`, `updatedAt`) VALUES
    ('ACTIVE', 'Действующее', true, 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('CLOSED', 'Закрыто', true, 2, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('TRANSFERRED', 'Переведено', true, 3, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

INSERT INTO `ContractStatus` (`code`, `name`, `allowsWork`, `isActive`, `sortOrder`, `createdAt`, `updatedAt`) VALUES
    ('DRAFT', 'Черновик', false, true, 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('ACTIVE', 'Действует', true, true, 2, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('CLOSED', 'Закрыт', false, true, 3, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

INSERT INTO `AddendumStatus` (`code`, `name`, `allowsWork`, `isActive`, `sortOrder`, `createdAt`, `updatedAt`) VALUES
    ('DRAFT', 'Черновик', false, true, 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('ACTIVE', 'Действует', true, true, 2, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('CLOSED', 'Закрыто', false, true, 3, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

INSERT INTO `WorkStatus` (`code`, `name`, `isActive`, `sortOrder`, `createdAt`, `updatedAt`) VALUES
    ('PLANNED', 'Запланирована', true, 1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('IN_PROGRESS', 'Выполняется', true, 2, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('COMPLETED', 'Завершена', true, 3, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('CANCELLED', 'Отменена', true, 4, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

INSERT INTO `Base` (`name`, `code`, `isActive`, `createdAt`, `updatedAt`) VALUES
    ('Нижневартовск', 'NZV_BPO', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    ('Астрахань', 'ASTR_BPO', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

INSERT INTO `Position` (`name`, `sortOrder`, `isArchived`, `createdAt`, `updatedAt`)
SELECT seed.`name`, seed.`sortOrder`, false, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (
    SELECT 'Координатор' AS `name`, 1 AS `sortOrder`
    UNION ALL SELECT 'Техник по бурению 3 категории', 2
    UNION ALL SELECT 'Техник по бурению 2 категории', 3
    UNION ALL SELECT 'Техник по бурению 1 категории', 4
    UNION ALL SELECT 'Инженер по бурению 3 категории', 5
    UNION ALL SELECT 'Инженер по бурению 2 категории', 6
    UNION ALL SELECT 'Инженер по бурению 1 категории', 7
    UNION ALL SELECT 'Инженер по бурению', 8
    UNION ALL SELECT 'Руководитель группы', 9
    UNION ALL SELECT 'Старший инженер по бурению', 10
    UNION ALL SELECT 'Старший механик', 11
    UNION ALL SELECT 'Механик', 12
    UNION ALL SELECT 'Мастер цеха', 13
    UNION ALL SELECT 'Слесарь', 14
    UNION ALL SELECT 'Менеджер БПО', 15
) AS seed
WHERE NOT EXISTS (
    SELECT 1 FROM `Position` existing WHERE existing.`name` = seed.`name`
);

-- Keep existing accounts as the compatibility boundary; do not invent an org structure.
INSERT INTO `Employee` (`userId`, `createdAt`, `updatedAt`)
SELECT u.`id`, u.`createdAt`, CURRENT_TIMESTAMP(3)
FROM `User` u;

INSERT INTO `UserSystemRole` (`userId`, `systemRoleId`, `currentUserRoleKey`, `assignedAt`)
SELECT u.`id`, r.`id`, CONCAT(u.`id`, ':', r.`id`), CURRENT_TIMESTAMP(3)
FROM `User` u
JOIN `SystemRole` r ON r.`code` = IF(u.`role` = 'ADMIN', 'ADMIN', 'EMPLOYEE');

INSERT INTO `EmployeeAssignment`
    (`employeeId`, `positionId`, `baseId`, `supervisorEmployeeId`, `statusId`, `track`,
     `startsAt`, `endsAt`, `activeEmployeeId`, `reason`, `operationId`, `createdAt`)
SELECT e.`id`, u.`positionId`, NULL, NULL, s.`id`, 'UNASSIGNED',
       DATE(u.`createdAt`), NULL, e.`id`,
       'Импорт из существующей учётной записи; оргструктура требует назначения',
       CONCAT('legacy-', LPAD(u.`id`, 28, '0')), CURRENT_TIMESTAMP(3)
FROM `User` u
JOIN `Employee` e ON e.`userId` = u.`id`
JOIN `AssignmentStatus` s ON s.`code` = 'ACTIVE';
