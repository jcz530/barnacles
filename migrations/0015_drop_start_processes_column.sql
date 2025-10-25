-- Drop the old start_processes JSON column from projects table
-- This is the final step after migrating data to normalized tables

ALTER TABLE `projects` DROP COLUMN `start_processes`;
