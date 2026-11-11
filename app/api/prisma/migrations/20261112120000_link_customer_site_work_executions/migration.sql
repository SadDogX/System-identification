ALTER TABLE `WorkExecution`
    ADD COLUMN `customerSiteWorkId` INTEGER NULL,
    ADD INDEX `WorkExecution_customerSiteWorkId_performedAt_idx`(`customerSiteWorkId`, `performedAt`),
    ADD CONSTRAINT `WorkExecution_customerSiteWorkId_fkey`
        FOREIGN KEY (`customerSiteWorkId`) REFERENCES `CustomerSiteWork`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;
