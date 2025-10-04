export interface TechnologyDetector {
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  files: string[];
  packageJsonKeys?: string[];
}

export const TECHNOLOGY_DETECTORS: TechnologyDetector[] = [
  {
    name: 'Node.js',
    slug: 'nodejs',
    icon: 'nodejs',
    color: '#339933',
    files: ['package.json'],
  },
  {
    name: 'TypeScript',
    slug: 'typescript',
    icon: 'typescript',
    color: '#3178C6',
    files: ['tsconfig.json'],
  },
  {
    name: 'Vue',
    slug: 'vue',
    icon: 'vue',
    color: '#42B883',
    files: [],
    packageJsonKeys: ['vue'],
  },
  {
    name: 'React',
    slug: 'react',
    icon: 'react',
    color: '#61DAFB',
    files: [],
    packageJsonKeys: ['react'],
  },
  {
    name: 'Next.js',
    slug: 'nextjs',
    icon: 'nextjs',
    color: '#000000',
    files: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    packageJsonKeys: ['next'],
  },
  {
    name: 'Nuxt',
    slug: 'nuxt',
    icon: 'nuxt',
    color: '#00DC82',
    files: ['nuxt.config.js', 'nuxt.config.ts'],
    packageJsonKeys: ['nuxt'],
  },
  {
    name: 'Laravel',
    slug: 'laravel',
    icon: 'laravel',
    color: '#FF2D20',
    files: ['artisan', 'composer.json'],
  },
  {
    name: 'PHP',
    slug: 'php',
    icon: 'php',
    color: '#777BB4',
    files: ['composer.json'],
  },
  {
    name: 'Python',
    slug: 'python',
    icon: 'python',
    color: '#3776AB',
    files: ['requirements.txt', 'pyproject.toml', 'setup.py'],
  },
  {
    name: 'Django',
    slug: 'django',
    icon: 'django',
    color: '#092E20',
    files: ['manage.py'],
  },
  {
    name: 'Rust',
    slug: 'rust',
    icon: 'rust',
    color: '#000000',
    files: ['Cargo.toml'],
  },
  {
    name: 'Go',
    slug: 'go',
    icon: 'go',
    color: '#00ADD8',
    files: ['go.mod'],
  },
  {
    name: 'Docker',
    slug: 'docker',
    icon: 'docker',
    color: '#2496ED',
    files: ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'],
  },
  {
    name: 'Git',
    slug: 'git',
    icon: 'git',
    color: '#F05032',
    files: ['.git'],
  },
  {
    name: 'Vite',
    slug: 'vite',
    icon: 'vite',
    color: '#646CFF',
    files: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'],
    packageJsonKeys: ['vite'],
  },
  {
    name: 'Electron',
    slug: 'electron',
    icon: 'electron',
    color: '#47848F',
    files: [],
    packageJsonKeys: ['electron'],
  },
  {
    name: 'Tailwind CSS',
    slug: 'tailwindcss',
    icon: 'tailwindcss',
    color: '#06B6D4',
    files: ['tailwind.config.js', 'tailwind.config.ts'],
    packageJsonKeys: ['tailwindcss'],
  },
];
