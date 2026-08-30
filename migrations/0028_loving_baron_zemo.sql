-- Flag for a project whose directory has gone missing.
--
-- Only the ADD is kept: drizzle-kit also regenerated DROP COLUMN statements for
-- the git columns, but hand-written migration 0027 already dropped them (its
-- change is not in the generated snapshot). Re-dropping them fails the whole
-- migration chain.
ALTER TABLE `projects` ADD `missing_since` integer;
