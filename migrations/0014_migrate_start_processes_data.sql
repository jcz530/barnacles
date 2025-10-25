-- Migration to move data from start_processes JSON column to normalized tables
-- This migration script handles the data transfer

-- Step 1: Insert into project_processes from start_processes JSON
INSERT INTO project_processes (id, project_id, name, working_dir, color, url, "order", created_at, updated_at)
SELECT
  -- Generate unique ID by combining project ID with original process ID
  lower(hex(randomblob(8))) || substr(json_extract(je.value, '$.id'), -8) as id,
  projects.id as project_id,
  json_extract(je.value, '$.name') as name,
  json_extract(je.value, '$.workingDir') as working_dir,
  json_extract(je.value, '$.color') as color,
  json_extract(je.value, '$.url') as url,
  je.key as "order", -- Use the array index as the order
  unixepoch('now') as created_at,
  unixepoch('now') as updated_at
FROM projects
CROSS JOIN json_each(projects.start_processes) as je
WHERE projects.start_processes IS NOT NULL
  AND projects.start_processes != 'null'
  AND projects.start_processes != '';
--> statement-breakpoint
-- Step 2: Insert into project_process_commands from the commands array
INSERT INTO project_process_commands (id, process_id, command, "order", created_at)
SELECT
  lower(hex(randomblob(16))) as id, -- Generate a random ID
  pp.id as process_id,
  cmd.value as command, -- cmd.value is already the string value from json_each
  cmd.key as "order", -- Use the array index as the order
  unixepoch('now') as created_at
FROM projects p
CROSS JOIN json_each(p.start_processes) as proc
CROSS JOIN json_each(json_extract(proc.value, '$.commands')) as cmd
INNER JOIN project_processes pp ON
  pp.project_id = p.id
  AND pp."order" = proc.key
WHERE p.start_processes IS NOT NULL
  AND p.start_processes != 'null'
  AND p.start_processes != ''
  AND json_extract(proc.value, '$.commands') IS NOT NULL;
