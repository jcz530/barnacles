import { Hono } from 'hono';
import core from './core';
import files from './files';
import packages from './packages';
import processes from './processes';
import relatedFolders from './related-folders';
import exclusions from './exclusions';
import technologies from './technologies';
import tools from './tools';
import accounts from './accounts';
import gitStats from './git-stats';

const projects = new Hono();

/**
 * Mount sub-routes
 * Order matters: more specific routes should be mounted before catch-all routes
 */

// Technologies (must be before /:id routes)
projects.route('/', technologies);

// Tools - IDE and Terminal management (must be before /:id routes)
projects.route('/', tools);

// Processes (must be before /:id routes for /process-status)
projects.route('/', processes);

// Git stats (must be before /:id routes)
projects.route('/', gitStats);

// Packages
projects.route('/', packages);

// Files
projects.route('/', files);

// Related folders
projects.route('/', relatedFolders);

// Exclusions (file tree hidden directories)
projects.route('/', exclusions);

// Accounts
projects.route('/', accounts);

// Core routes (includes /:id which is a catch-all, so must be last)
projects.route('/', core);

export default projects;
