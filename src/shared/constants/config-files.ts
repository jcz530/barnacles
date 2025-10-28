/**
 * Common developer configuration files and directories
 * Used to populate the Config Files viewer
 */

export const CONFIG_FILE_PATHS = [
  // Shell Configuration
  '~/.zshrc',
  '~/.zshenv',
  '~/.zprofile',
  '~/.zlogin',
  '~/.zlogout',
  '~/.bashrc',
  '~/.bash_profile',
  '~/.profile',
  '~/.inputrc',

  // Git Configuration
  '~/.gitconfig',
  '~/.gitignore_global',
  '~/.gitmessage',
  '~/.gitconfig.local',

  // SSH & Security
  '~/.ssh/',

  // Editor Configurations
  '~/.vimrc',
  '~/.vim/',
  '~/.nanorc',
  '~/.editorconfig',
  '~/.emacs',
  '~/.emacs.d/',

  // Terminal & Multiplexer
  '~/.tmux.conf',
  '~/.screenrc',
  '~/.alacritty.yml',
  '~/.hyper.js',

  // Language-Specific - Node.js/JavaScript
  '~/.npmrc',
  '~/.yarnrc',
  '~/.yarnrc.yml',
  '~/.pnpmrc',
  '~/.bunfig.toml',
  '~/.eslintrc',
  '~/.prettierrc',

  // Language-Specific - Python
  '~/.pypirc',
  '~/.condarc',
  '~/.pythonrc',
  '~/.pip/',

  // Language-Specific - Ruby
  '~/.gemrc',
  '~/.irbrc',
  '~/.pryrc',
  '~/.rspec',

  // Database Clients
  '~/.psqlrc',
  '~/.my.cnf',
  '~/.mongorc.js',
  '~/.redisclirc',
  '~/.sqliterc',

  // Cloud & DevOps Tools - AWS
  '~/.aws/',

  // Cloud & DevOps Tools - Docker
  // '~/.docker/',

  // Cloud & DevOps Tools - Kubernetes
  '~/.kube/',

  // Version Managers
  '~/.tool-versions',
  '~/.nvmrc',
  '~/.ruby-version',
  '~/.python-version',

  // Utilities & CLI Tools
  '~/.curlrc',
  '~/.wgetrc',
  '~/.ripgreprc',
  '~/.fdignore',
  '~/.rgignore',
  '~/.ctags',
  '~/.ackrc',
  '~/.agignore',
  '~/.dircolors',
  '~/.hushlogin',
  '~/.selected_editor',

  // Linters & Formatters
  '~/.shellcheckrc',
  '~/.markdownlint.json',
  '~/.yamllint',
  '~/.hadolint.yaml',

  // Specialized Tools
  '~/.lftprc',
  '~/.muttrc',
  '~/.jqrc',
  '~/.myclirc',

  // GPG
  '~/.gnupg/',

  // Network
  '~/.netrc',

  // Cargo (Rust)
  '~/.cargo/',

  // Maven
  '~/.m2/',

  // Gradle
  // '~/.gradle/',

  // Terraform
  '~/.terraformrc',

  // Entire .config directory (recursive)
  '~/.config/',
] as const;

/**
 * Categories for organizing config files
 */
export const CONFIG_FILE_CATEGORIES = {
  SHELL: 'Shell & Terminal',
  GIT: 'Version Control',
  EDITORS: 'Editors & IDEs',
  LANGUAGES: 'Languages & Runtimes',
  CLOUD: 'Cloud & DevOps',
  DATABASE: 'Database Tools',
  UTILITIES: 'Utilities & CLI',
  SECURITY: 'Security & SSH',
  CONFIG_DIR: 'Config Directory',
} as const;

/**
 * Mapping of file patterns with categories
 */
export const CONFIG_FILE_CATEGORY_MAP: Record<string, string> = {
  // Shell
  '.zshrc': CONFIG_FILE_CATEGORIES.SHELL,
  '.zshenv': CONFIG_FILE_CATEGORIES.SHELL,
  '.zprofile': CONFIG_FILE_CATEGORIES.SHELL,
  '.zlogin': CONFIG_FILE_CATEGORIES.SHELL,
  '.zlogout': CONFIG_FILE_CATEGORIES.SHELL,
  '.bashrc': CONFIG_FILE_CATEGORIES.SHELL,
  '.bash_profile': CONFIG_FILE_CATEGORIES.SHELL,
  '.profile': CONFIG_FILE_CATEGORIES.SHELL,
  '.inputrc': CONFIG_FILE_CATEGORIES.SHELL,
  '.tmux.conf': CONFIG_FILE_CATEGORIES.SHELL,
  '.screenrc': CONFIG_FILE_CATEGORIES.SHELL,
  '.alacritty.yml': CONFIG_FILE_CATEGORIES.SHELL,
  '.hyper.js': CONFIG_FILE_CATEGORIES.SHELL,

  // Git
  '.gitconfig': CONFIG_FILE_CATEGORIES.GIT,
  '.gitignore_global': CONFIG_FILE_CATEGORIES.GIT,
  '.gitmessage': CONFIG_FILE_CATEGORIES.GIT,

  // Editors
  '.vimrc': CONFIG_FILE_CATEGORIES.EDITORS,
  '.nanorc': CONFIG_FILE_CATEGORIES.EDITORS,
  '.editorconfig': CONFIG_FILE_CATEGORIES.EDITORS,
  '.emacs': CONFIG_FILE_CATEGORIES.EDITORS,

  // Languages
  '.npmrc': CONFIG_FILE_CATEGORIES.LANGUAGES,
  '.yarnrc': CONFIG_FILE_CATEGORIES.LANGUAGES,
  '.pnpmrc': CONFIG_FILE_CATEGORIES.LANGUAGES,
  '.bunfig.toml': CONFIG_FILE_CATEGORIES.LANGUAGES,
  '.pypirc': CONFIG_FILE_CATEGORIES.LANGUAGES,
  '.condarc': CONFIG_FILE_CATEGORIES.LANGUAGES,
  '.pythonrc': CONFIG_FILE_CATEGORIES.LANGUAGES,
  '.gemrc': CONFIG_FILE_CATEGORIES.LANGUAGES,
  '.irbrc': CONFIG_FILE_CATEGORIES.LANGUAGES,
  '.pryrc': CONFIG_FILE_CATEGORIES.LANGUAGES,

  // Security
  '.ssh': CONFIG_FILE_CATEGORIES.SECURITY,
  '.gnupg': CONFIG_FILE_CATEGORIES.SECURITY,
  '.netrc': CONFIG_FILE_CATEGORIES.SECURITY,

  // Cloud
  '.aws': CONFIG_FILE_CATEGORIES.CLOUD,
  '.docker': CONFIG_FILE_CATEGORIES.CLOUD,
  '.kube': CONFIG_FILE_CATEGORIES.CLOUD,
  '.terraformrc': CONFIG_FILE_CATEGORIES.CLOUD,

  // Database
  '.psqlrc': CONFIG_FILE_CATEGORIES.DATABASE,
  '.my.cnf': CONFIG_FILE_CATEGORIES.DATABASE,
  '.mongorc.js': CONFIG_FILE_CATEGORIES.DATABASE,
  '.redisclirc': CONFIG_FILE_CATEGORIES.DATABASE,
  '.sqliterc': CONFIG_FILE_CATEGORIES.DATABASE,

  // Utilities
  '.curlrc': CONFIG_FILE_CATEGORIES.UTILITIES,
  '.wgetrc': CONFIG_FILE_CATEGORIES.UTILITIES,
  '.ripgreprc': CONFIG_FILE_CATEGORIES.UTILITIES,

  // Config directory
  '.config': CONFIG_FILE_CATEGORIES.CONFIG_DIR,
};
