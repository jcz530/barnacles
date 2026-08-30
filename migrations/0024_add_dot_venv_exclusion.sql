-- Add '.venv' to the stored scanExcludedDirectories setting.
--
-- The default list gained '.venv', but defaults only fill in settings rows that are
-- absent -- any user who has this setting persisted keeps the old list. Python projects
-- using the '.venv' convention (rather than 'venv') therefore have the entire virtualenv
-- walked and line-counted on every scan.
--
-- Idempotent: the WHERE clause skips rows that already contain '.venv'. Note the
-- LIKE pattern matches the quoted JSON element '".venv"' so it cannot be satisfied
-- by the existing '"venv"' entry.
UPDATE settings
SET value = json_insert(value, '$[#]', '.venv'),
    updated_at = unixepoch('now')
WHERE key = 'scanExcludedDirectories'
  AND json_valid(value)
  AND value NOT LIKE '%".venv"%';
