-- Record where an MCP tool call came from: the directory the server process was
-- launched in, and the terminal it was launched from. Both are captured once per
-- server process and are best-effort -- a GUI-launched client (Claude Desktop)
-- has no terminal and no meaningful cwd, so both stay null there.
--
-- The project is deliberately not stored. It is resolved from working_dir on
-- read, so events logged before a project existed still attribute correctly and
-- a re-pathed project never goes stale.
ALTER TABLE `events` ADD `working_dir` text;--> statement-breakpoint
ALTER TABLE `events` ADD `terminal` text;
