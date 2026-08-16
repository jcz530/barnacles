/**
 * Demo shell aliases. Categories match the schema's git/docker/system/custom
 * enum so the Aliases page renders its full colour range.
 */

export interface DemoAlias {
  name: string;
  command: string;
  description: string;
  category: 'git' | 'docker' | 'system' | 'custom';
  showCommand: boolean;
  order: number;
}

export const DEMO_ALIASES: DemoAlias[] = [
  {
    name: 'gs',
    command: 'git status --short --branch',
    description: 'Compact status with branch info',
    category: 'git',
    showCommand: true,
    order: 0,
  },
  {
    name: 'gco',
    command: 'git checkout',
    description: 'Switch branches',
    category: 'git',
    showCommand: true,
    order: 1,
  },
  {
    name: 'glog',
    command: 'git log --oneline --graph --decorate -20',
    description: 'Recent history as a graph',
    category: 'git',
    showCommand: true,
    order: 2,
  },
  {
    name: 'gundo',
    command: 'git reset --soft HEAD~1',
    description: 'Undo the last commit, keep the changes',
    category: 'git',
    showCommand: true,
    order: 3,
  },
  {
    name: 'dps',
    command: 'docker ps --format "table {{.Names}}\\t{{.Status}}"',
    description: 'Running containers, names and status only',
    category: 'docker',
    showCommand: true,
    order: 4,
  },
  {
    name: 'dclean',
    command: 'docker system prune -f',
    description: 'Remove unused containers and images',
    category: 'docker',
    showCommand: true,
    order: 5,
  },
  {
    name: 'dcu',
    command: 'docker compose up -d',
    description: 'Start the stack in the background',
    category: 'docker',
    showCommand: true,
    order: 6,
  },
  {
    name: 'ports',
    command: 'lsof -iTCP -sTCP:LISTEN -P -n',
    description: 'Everything listening locally',
    category: 'system',
    showCommand: true,
    order: 7,
  },
  {
    name: 'reload',
    command: 'source ~/.zshrc',
    description: 'Reload the shell config',
    category: 'system',
    showCommand: true,
    order: 8,
  },
  {
    name: 'll',
    command: 'ls -lah',
    description: 'Detailed listing including hidden files',
    category: 'system',
    showCommand: true,
    order: 9,
  },
  {
    name: 'serve',
    command: 'python3 -m http.server 8000',
    description: 'Static file server in the current directory',
    category: 'custom',
    showCommand: true,
    order: 10,
  },
  {
    name: 'weather',
    command: 'curl wttr.in',
    description: 'Forecast in the terminal',
    category: 'custom',
    showCommand: true,
    order: 11,
  },
];
