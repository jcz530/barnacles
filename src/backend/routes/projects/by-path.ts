import { Hono } from 'hono';
import { projectService } from '../../services/project';
import nodePath from 'path';
import fs from 'fs/promises';
import { scanDirectoryService } from '../../services/scan-directory-service';
import { projectScannerService } from '../../services/project-scanner-service';
import { expandTilde } from '../../utils/path-utils';

const byPath = new Hono();

/**
 * GET /meta/by-path
 * Find the project whose root path matches or contains the given path
 */
byPath.get('/meta/by-path', async c => {
  const path = c.req.query('path');

  if (!path) {
    return c.json({ error: 'path query parameter is required' }, 400);
  }

  const project = await projectService.getProjectByPath(path);

  if (!project) {
    return c.json(
      {
        error:
          `No project found containing path "${path}". ` +
          'If this directory should be tracked, add it with add_project.',
      },
      404
    );
  }

  return c.json({
    data: project,
  });
});

/**
 * POST /meta/by-path
 * Track the project at the given path, adding it if Barnacles does not know it
 * yet. Works for paths outside the configured scan directories — those would
 * otherwise be unreachable, since a scan never walks them.
 */
byPath.post('/meta/by-path', async c => {
  const body: { path?: unknown } | null = await c.req.json().catch((): null => null);
  const input = body?.path;

  if (!input || typeof input !== 'string') {
    return c.json({ error: 'path is required' }, 400);
  }

  const expanded = expandTilde(input);

  // A relative path would be resolved against the backend's cwd, which has
  // nothing to do with the caller's. Storing it would leave a row whose meaning
  // changes if the backend ever starts somewhere else.
  if (!nodePath.isAbsolute(expanded)) {
    return c.json({ error: `"${input}" is not an absolute path.` }, 400);
  }

  // Canonicalise once and use that single value everywhere below: projects are
  // upserted on an exact path match, so "/x" and "/x/" would otherwise become
  // two rows for one directory.
  let projectPath: string;
  try {
    projectPath = await fs.realpath(nodePath.resolve(expanded));
  } catch {
    return c.json({ error: `"${input}" does not exist.` }, 422);
  }

  // Exact match, not the containing-project resolver: a subdirectory of a
  // tracked project is a new project here, not the parent being refreshed.
  const existing = await projectService.getProjectByExactPath(projectPath);

  // Check the marker files up front so an unrecognised directory is reported as
  // such, rather than being lumped in with genuine scan failures below.
  if (!(await projectScannerService.isValidProject(projectPath))) {
    return c.json(
      {
        error:
          `"${input}" does not look like a project. Barnacles identifies projects by a ` +
          'marker file (package.json, composer.json, Cargo.toml, go.mod, requirements.txt, ' +
          'pom.xml, build.gradle) or a .git directory.',
      },
      422
    );
  }

  const project = await projectService.rescanProject(projectPath);

  const withinScanDirectories = await scanDirectoryService.covers(project.path);

  return c.json({
    data: project,
    meta: {
      created: !existing,
      withinScanDirectories,
      // Only meaningful when the project sits outside the scan directories —
      // the directory the user would add to have future scans find it.
      suggestedScanDirectory: withinScanDirectories ? null : nodePath.dirname(project.path),
    },
    message: existing ? 'Project already tracked; refreshed.' : 'Project added.',
  });
});

export default byPath;
