-- Defensively remove any duplicate (project_id, technology_id) rows before
-- adding the unique index below, so environments with pre-existing dupes
-- (from the runaway-save bug) don't fail to migrate.
DELETE FROM `project_technologies`
WHERE `id` NOT IN (
  SELECT MIN(`id`)
  FROM `project_technologies`
  GROUP BY `project_id`, `technology_id`
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_technologies_project_id_technology_id_unique` ON `project_technologies` (`project_id`,`technology_id`);
