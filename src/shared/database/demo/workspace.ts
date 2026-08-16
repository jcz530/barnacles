import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getAppDataDir } from '../paths';
import { DEMO_PROJECTS } from './data/projects';

/**
 * Creates a small on-disk tree for each demo project.
 *
 * Several views (README, Files, Related Files) read the real filesystem via
 * project.path rather than the database, so without this they render empty
 * states — useless as screenshots. The tree lives inside the disposable demo
 * profile and is removed with it.
 */

/**
 * Root of the fake workspace.
 *
 * Named "Development" rather than something like "workspace" because this path
 * is rendered in the UI (project detail, file browser) and ends up in published
 * screenshots — it should read like a real projects directory.
 */
export function getDemoWorkspaceRoot(): string {
  return path.join(getAppDataDir(), 'Development');
}

/** On-disk location for a demo project, replacing its cosmetic /Users/dev path. */
export function demoProjectPath(projectName: string): string {
  return path.join(getDemoWorkspaceRoot(), projectName);
}

function readmeFor(name: string, description: string, technologies: string[]): string {
  const stack = technologies.map(t => `- ${t}`).join('\n');

  return `# ${name}

${description}

## Getting Started

Install dependencies and start the development server:

\`\`\`bash
npm install
npm run dev
\`\`\`

The service listens on [http://localhost:4000](http://localhost:4000) by default.

## Stack

${stack}

## Scripts

| Script | Description |
| --- | --- |
| \`npm run dev\` | Start the development server |
| \`npm run build\` | Produce a production build |
| \`npm test\` | Run the test suite |

## Configuration

Copy \`.env.example\` to \`.env\` and adjust as needed:

\`\`\`ts
export const config = {
  port: Number(process.env.PORT ?? 4000),
  logLevel: process.env.LOG_LEVEL ?? 'info',
};
\`\`\`

## License

MIT
`;
}

const SAMPLE_SOURCE = `import { createServer } from './server';
import { config } from './config';

const server = createServer(config);

server.listen(config.port, () => {
  console.log(\`listening on :\${config.port}\`);
});
`;

/**
 * Write the demo workspace to disk. Idempotent — files are overwritten.
 */
export async function createDemoWorkspace(): Promise<void> {
  for (const project of DEMO_PROJECTS) {
    const root = demoProjectPath(project.name);

    await mkdir(path.join(root, 'src'), { recursive: true });
    await mkdir(path.join(root, 'docs'), { recursive: true });

    await writeFile(
      path.join(root, 'README.md'),
      readmeFor(project.name, project.description, project.technologies)
    );
    await writeFile(path.join(root, 'src', 'index.ts'), SAMPLE_SOURCE);
    await writeFile(
      path.join(root, 'package.json'),
      `${JSON.stringify(
        {
          name: project.name,
          version: '1.4.2',
          private: true,
          scripts: { dev: 'vite', build: 'vite build', test: 'vitest run' },
        },
        null,
        2
      )}\n`
    );
    await writeFile(
      path.join(root, 'docs', 'architecture.md'),
      `# Architecture\n\nNotes on how ${project.name} fits together.\n`
    );
  }
}
