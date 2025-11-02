import { createId } from '@paralleldrive/cuid2';
import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const projects = sqliteTable('projects', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull(),
  path: text('path').notNull().unique(),
  description: text('description'),
  icon: text('icon'), // relative path to icon/logo file from project root
  lastModified: integer('last_modified', { mode: 'timestamp' }),
  size: integer('size'), // in bytes
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  archivedAt: integer('archived_at', { mode: 'timestamp' }),
  preferredIde: text('preferred_ide'),
  preferredTerminal: text('preferred_terminal'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const technologies = sqliteTable('technologies', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  icon: text('icon'),
  color: text('color'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const projectTechnologies = sqliteTable('project_technologies', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  technologyId: text('technology_id')
    .notNull()
    .references(() => technologies.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const projectStats = sqliteTable('project_stats', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  fileCount: integer('file_count'),
  directoryCount: integer('directory_count'),
  linesOfCode: integer('lines_of_code'), // total lines of code
  thirdPartySize: integer('third_party_size'), // total size of third-party packages in bytes (node_modules, vendor, etc.)
  gitBranch: text('git_branch'),
  gitStatus: text('git_status'),
  gitRemoteUrl: text('git_remote_url'),
  lastCommitDate: integer('last_commit_date', { mode: 'timestamp' }),
  lastCommitMessage: text('last_commit_message'),
  hasUncommittedChanges: integer('has_uncommitted_changes', { mode: 'boolean' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const projectLanguageStats = sqliteTable('project_language_stats', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  technologySlug: text('technology_slug').notNull(),
  fileCount: integer('file_count').notNull(),
  percentage: integer('percentage').notNull(), // stored as integer (e.g., 525 = 52.5%)
  linesOfCode: integer('lines_of_code').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const projectProcesses = sqliteTable('project_processes', {
  id: text('id').primaryKey(), // Use the same ID from StartProcess
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  workingDir: text('working_dir'), // relative to project root
  color: text('color'),
  url: text('url'), // optional URL where the process will be accessible
  order: integer('order').notNull(), // to maintain order of processes
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const projectProcessCommands = sqliteTable('project_process_commands', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  processId: text('process_id')
    .notNull()
    .references(() => projectProcesses.id, { onDelete: 'cascade' }),
  command: text('command').notNull(),
  order: integer('order').notNull(), // to maintain order of commands
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const projectRelatedFolders = sqliteTable('project_related_folders', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  folderPath: text('folder_path').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Relations
export const projectsRelations = relations(projects, ({ many, one }) => ({
  technologies: many(projectTechnologies),
  stats: one(projectStats, {
    fields: [projects.id],
    references: [projectStats.projectId],
  }),
  processes: many(projectProcesses),
  relatedFolders: many(projectRelatedFolders),
}));

export const technologiesRelations = relations(technologies, ({ many }) => ({
  projects: many(projectTechnologies),
}));

export const projectTechnologiesRelations = relations(projectTechnologies, ({ one }) => ({
  project: one(projects, {
    fields: [projectTechnologies.projectId],
    references: [projects.id],
  }),
  technology: one(technologies, {
    fields: [projectTechnologies.technologyId],
    references: [technologies.id],
  }),
}));

export const projectStatsRelations = relations(projectStats, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectStats.projectId],
    references: [projects.id],
  }),
  languageStats: many(projectLanguageStats),
}));

export const projectLanguageStatsRelations = relations(projectLanguageStats, ({ one }) => ({
  project: one(projects, {
    fields: [projectLanguageStats.projectId],
    references: [projects.id],
  }),
  projectStats: one(projectStats, {
    fields: [projectLanguageStats.projectId],
    references: [projectStats.projectId],
  }),
}));

export const projectProcessesRelations = relations(projectProcesses, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectProcesses.projectId],
    references: [projects.id],
  }),
  commands: many(projectProcessCommands),
}));

export const projectProcessCommandsRelations = relations(projectProcessCommands, ({ one }) => ({
  process: one(projectProcesses, {
    fields: [projectProcessCommands.processId],
    references: [projectProcesses.id],
  }),
}));

export const projectRelatedFoldersRelations = relations(projectRelatedFolders, ({ one }) => ({
  project: one(projects, {
    fields: [projectRelatedFolders.projectId],
    references: [projects.id],
  }),
}));

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  type: text('type', { enum: ['string', 'number', 'boolean', 'json'] })
    .notNull()
    .default('string'),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const aliases = sqliteTable('aliases', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull(),
  command: text('command').notNull(),
  description: text('description'),
  color: text('color'), // ANSI color code or null to use theme
  showCommand: integer('show_command', { mode: 'boolean' }).notNull().default(true),
  category: text('category').notNull().default('custom'), // git, docker, system, custom
  order: integer('order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const aliasThemes = sqliteTable('alias_themes', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull().unique(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  gitColor: text('git_color').notNull().default('32'), // green
  dockerColor: text('docker_color').notNull().default('34'), // blue
  systemColor: text('system_color').notNull().default('33'), // yellow
  customColor: text('custom_color').notNull().default('36'), // cyan
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const themes = sqliteTable('themes', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull().unique(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false), // pre-defined themes cannot be deleted
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  // Base colors stored as hex values - will be processed to generate full palettes
  primaryColor: text('primary_color').notNull().default('#00c2e5'), // sky-500
  slateColor: text('slate_color').notNull().default('#64748b'), // slate-500
  // Design tokens
  borderRadius: text('border_radius', { enum: ['none', 'sm', 'md', 'lg', 'xl'] })
    .notNull()
    .default('md'),
  shadowIntensity: integer('shadow_intensity').notNull().default(3), // 0-6 (maps to shadow-2xs through shadow-2xl)
  // Advanced customization - JSON object with CSS variable overrides
  customCssVars: text('custom_css_vars'), // JSON stringified object like {"--accent": "#ff0000"}
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});
