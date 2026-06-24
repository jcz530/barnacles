export interface ProcessInfo {
  label: string;
  description: string;
}

// Keyed by lowercase substring that appears in the process name.
// Entries are checked in order; first match wins.
const PROCESS_ENRICHMENT: Array<{ pattern: string } & ProcessInfo> = [
  // Language runtimes
  { pattern: 'node', label: 'Node.js', description: 'JavaScript runtime' },
  { pattern: 'deno', label: 'Deno', description: 'JavaScript / TypeScript runtime' },
  { pattern: 'bun', label: 'Bun', description: 'JavaScript runtime & package manager' },
  { pattern: 'python', label: 'Python', description: 'Python interpreter' },
  { pattern: 'ruby', label: 'Ruby', description: 'Ruby interpreter' },
  { pattern: 'php', label: 'PHP', description: 'PHP interpreter' },
  { pattern: 'java', label: 'Java', description: 'Java Virtual Machine' },
  { pattern: 'dotnet', label: '.NET', description: '.NET runtime' },
  { pattern: 'elixir', label: 'Elixir', description: 'Elixir language runtime' },
  { pattern: 'beam', label: 'BEAM VM', description: 'Erlang/Elixir virtual machine' },
  { pattern: 'erlang', label: 'Erlang', description: 'Erlang runtime' },
  { pattern: 'perl', label: 'Perl', description: 'Perl interpreter' },
  { pattern: 'cargo', label: 'Cargo', description: 'Rust build tool & package manager' },
  { pattern: 'go', label: 'Go', description: 'Go language runtime' },
  { pattern: 'rust', label: 'Rust', description: 'Rust runtime' },

  // Bundlers / dev servers
  { pattern: 'vite', label: 'Vite', description: 'Frontend dev server & bundler' },
  { pattern: 'webpack', label: 'Webpack', description: 'JavaScript module bundler' },
  { pattern: 'next', label: 'Next.js', description: 'React framework dev server' },
  { pattern: 'nuxt', label: 'Nuxt', description: 'Vue framework dev server' },
  { pattern: 'parcel', label: 'Parcel', description: 'Zero-config bundler' },
  { pattern: 'esbuild', label: 'esbuild', description: 'Fast JavaScript bundler' },
  { pattern: 'rollup', label: 'Rollup', description: 'JavaScript module bundler' },
  { pattern: 'turbo', label: 'Turborepo', description: 'Monorepo build system' },
  { pattern: 'expo', label: 'Expo', description: 'React Native dev server' },
  { pattern: 'metro', label: 'Metro', description: 'React Native JavaScript bundler' },

  // Web / app servers
  { pattern: 'puma', label: 'Puma', description: 'Ruby web server' },
  { pattern: 'unicorn', label: 'Unicorn', description: 'Ruby web server' },
  { pattern: 'gunicorn', label: 'Gunicorn', description: 'Python WSGI web server' },
  { pattern: 'uvicorn', label: 'Uvicorn', description: 'Python ASGI web server' },
  { pattern: 'hypercorn', label: 'Hypercorn', description: 'Python ASGI web server' },
  { pattern: 'waitress', label: 'Waitress', description: 'Python WSGI web server' },
  { pattern: 'thin', label: 'Thin', description: 'Ruby web server' },
  { pattern: 'passenger', label: 'Passenger', description: 'Ruby / Python app server' },
  { pattern: 'caddy', label: 'Caddy', description: 'Automatic HTTPS web server' },
  { pattern: 'traefik', label: 'Traefik', description: 'Cloud-native reverse proxy' },
  { pattern: 'nginx', label: 'nginx', description: 'High-performance web server' },

  // Databases
  { pattern: 'postgres', label: 'PostgreSQL', description: 'Relational database' },
  { pattern: 'mysqld', label: 'MySQL', description: 'Relational database' },
  { pattern: 'mongod', label: 'MongoDB', description: 'Document database' },
  { pattern: 'redis', label: 'Redis', description: 'In-memory data store' },
  { pattern: 'elastic', label: 'Elasticsearch', description: 'Search & analytics engine' },
  { pattern: 'qdrant', label: 'Qdrant', description: 'Vector database' },
  { pattern: 'sqlite', label: 'SQLite', description: 'Embedded relational database' },
  { pattern: 'mariadb', label: 'MariaDB', description: 'Relational database' },
  { pattern: 'minio', label: 'MinIO', description: 'S3-compatible object storage' },
  { pattern: 'cockroach', label: 'CockroachDB', description: 'Distributed SQL database' },
  { pattern: 'influx', label: 'InfluxDB', description: 'Time-series database' },
  { pattern: 'clickhouse', label: 'ClickHouse', description: 'Columnar analytics database' },

  // Dev tooling & runtimes
  { pattern: 'electron', label: 'Electron', description: 'Desktop app runtime' },
  {
    pattern: 'workerd',
    label: 'Cloudflare Workers runtime',
    description: 'Powers Cloudflare Workers locally (e.g. via wrangler dev)',
  },
  { pattern: 'wrangler', label: 'Wrangler', description: 'Cloudflare Workers CLI' },
  { pattern: 'ollama', label: 'Ollama', description: 'Local AI model server' },
  { pattern: 'localai', label: 'LocalAI', description: 'Local AI model server' },

  // PHP / misc frameworks
  { pattern: 'artisan', label: 'Laravel Artisan', description: 'Laravel framework CLI server' },
  { pattern: 'symfony', label: 'Symfony', description: 'PHP framework dev server' },
  { pattern: 'laravel', label: 'Laravel', description: 'PHP framework' },
];

// Matches `pattern` in `text` only at a word boundary, so short patterns like
// "go" or "java" don't false-positive inside unrelated names ("Google Chrome
// Helper", "javascript-something").
function matchesPattern(text: string, pattern: string): boolean {
  return new RegExp(`(?:^|[^a-z0-9])${pattern}(?:[^a-z0-9]|$)`).test(text);
}

export function getProcessInfo(processName: string): ProcessInfo | null {
  const lower = processName.toLowerCase();
  const match = PROCESS_ENRICHMENT.find(e => matchesPattern(lower, e.pattern));
  if (!match) return null;
  return { label: match.label, description: match.description };
}

// All patterns, for use in dev-process filtering (replaces the inline list in Ports.vue)
export const DEV_PROCESS_PATTERNS: string[] = PROCESS_ENRICHMENT.map(e => e.pattern);

export function isDevProcess(processName: string): boolean {
  const lower = processName.toLowerCase();
  return DEV_PROCESS_PATTERNS.some(pattern => matchesPattern(lower, pattern));
}
