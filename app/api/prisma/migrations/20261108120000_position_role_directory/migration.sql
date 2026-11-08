-- Centralize position role assignment using the existing SystemRole directory.
ALTER TABLE `Position` ADD COLUMN `systemRoleId` INTEGER NULL;

-- Explicit migration mapping from the current position directory to existing role keys.
UPDATE `Position` p JOIN `SystemRole` r ON r.`code` = CASE p.`name`
    WHEN 'Менеджер БПО' THEN 'MANAGER'
    WHEN 'Координатор' THEN 'COORDINATOR'
    WHEN 'Старший механик' THEN 'SENIOR_MECHANIC'
    WHEN 'Механик' THEN 'MECHANIC'
    WHEN 'Мастер цеха' THEN 'SHOP_FOREMAN'
    WHEN 'Слесарь' THEN 'SHOP_EMPLOYEE'
    ELSE 'EMPLOYEE'
END SET p.`systemRoleId` = r.`id`;

-- Abort migration if required directory records are absent rather than leave position role null.
ALTER TABLE `Position` MODIFY `systemRoleId` INTEGER NOT NULL;
CREATE INDEX `Position_systemRoleId_idx` ON `Position`(`systemRoleId`);
ALTER TABLE `Position` ADD CONSTRAINT `Position_systemRoleId_fkey` FOREIGN KEY (`systemRoleId`) REFERENCES `SystemRole`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep current employee grants as historical access. The runtime sync switches to position FK.
-- Backfill only missing grants for each user's current position; do not revoke unrelated roles.
INSERT INTO `UserSystemRole` (`userId`, `systemRoleId`, `currentUserRoleKey`, `assignedAt`)
SELECT u.`id`, p.`systemRoleId`, CONCAT(u.`id`, ':', p.`systemRoleId`), CURRENT_TIMESTAMP(3)
FROM `User` u
JOIN `Employee` e ON e.`userId` = u.`id`
JOIN `EmployeeAssignment` ea ON ea.`activeEmployeeId` = e.`id`
JOIN `Position` p ON p.`id` = ea.`positionId`
LEFT JOIN `UserSystemRole` existing ON existing.`userId` = u.`id` AND existing.`systemRoleId` = p.`systemRoleId` AND existing.`revokedAt` IS NULL
WHERE u.`role` <> 'ADMIN' AND existing.`id` IS NULL;
