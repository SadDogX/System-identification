-- Add descriptive metadata to the single system role directory.
ALTER TABLE `SystemRole` ADD COLUMN `description` TEXT NULL;

UPDATE `SystemRole` SET `description` = CASE `code`
  WHEN 'ADMIN' THEN 'Full administrative access.'
  WHEN 'MANAGER' THEN 'Manages assignments and work in the assigned BPO.'
  WHEN 'COORDINATOR' THEN 'Coordinates assigned fields and teams.'
  WHEN 'SENIOR_MECHANIC' THEN 'Cross-base mechanical lead.'
  WHEN 'MECHANIC' THEN 'Mechanical work.'
  WHEN 'SHOP_FOREMAN' THEN 'Leads workshop employees.'
  WHEN 'SHOP_EMPLOYEE' THEN 'Workshop employee.'
  WHEN 'EMPLOYEE' THEN 'General employee access.'
  ELSE ''
END;
ALTER TABLE `SystemRole` MODIFY COLUMN `description` TEXT NOT NULL;

-- Ensure the administrator role has an associated position before removing account-type roles.
INSERT INTO `Position` (`name`, `systemRoleId`, `sortOrder`, `isArchived`, `createdAt`, `updatedAt`)
SELECT 'Administrator', r.`id`, 0, false, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `SystemRole` r
WHERE r.`code` = 'ADMIN'
  AND NOT EXISTS (SELECT 1 FROM `Position` p WHERE p.`name` = 'Administrator');

-- Existing ADMIN users retain administrative access through their existing ADMIN grant.
-- Give their active organizational assignment an explicit administrator position.
UPDATE `User` u
JOIN `Position` p ON p.`name` = 'Administrator'
SET u.`positionId` = p.`id`
WHERE EXISTS (
  SELECT 1 FROM `UserSystemRole` g
  JOIN `SystemRole` r ON r.`id` = g.`systemRoleId`
  WHERE g.`userId` = u.`id` AND g.`revokedAt` IS NULL AND r.`code` = 'ADMIN'
);

UPDATE `EmployeeAssignment` ea
JOIN `Employee` e ON e.`id` = ea.`employeeId`
JOIN `User` u ON u.`id` = e.`userId`
JOIN `Position` p ON p.`name` = 'Administrator'
SET ea.`positionId` = p.`id`
WHERE ea.`activeEmployeeId` = e.`id`
  AND EXISTS (
    SELECT 1 FROM `UserSystemRole` g
    JOIN `SystemRole` r ON r.`id` = g.`systemRoleId`
    WHERE g.`userId` = u.`id` AND g.`revokedAt` IS NULL AND r.`code` = 'ADMIN'
  );

-- Fail safely before removing the old enum if any active account lacks role grants.
-- Every non-admin account already has a legacy EMPLOYEE grant; administrators have ADMIN.
-- Drop only the duplicated account classification column and its enum after preserving grants above.
DROP INDEX `User_role_isDeleted_idx` ON `User`;
ALTER TABLE `User` DROP COLUMN `role`;
