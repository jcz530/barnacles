/**
 * ANSI color codes for terminal output
 */
const colors = {
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  pink: '\x1b[95m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

/**
 * ASCII art logo for Barnacles
 * Inspired by the geometric logo design
 */
export const logo = `
${colors.cyan}    ▖ ▖ ▖▗ ▖ ${colors.reset}   
${colors.cyan}  ▗▝▖▘▘▝ ▘▐▝▖${colors.reset}  
${colors.cyan} ▗▐▘       ▚▝▖${colors.reset} 
${colors.cyan}▗▗▘▖ ▖ ▖▗ ▖▖▚▝▖${colors.reset}
${colors.cyan} ▘▝ ▘▝▝ ▘▝ ▝▝▝${colors.reset} 
`;

/**
 * Compact logo for inline use - trapezoid shape matching the brand
 * Uses ▔ for top-aligned middle section
 */
export const compactLogo = `${colors.cyan}◢▮◣${colors.reset}`;

/**
 * Get the branded app title
 */
export function getTitle(): string {
  return `${colors.bold}${colors.cyan}Barnacles${colors.reset}`;
}

/**
 * Print the full branded header
 */
export function printHeader(): void {
  console.log(logo);
  console.log(`  ${colors.bold}${colors.cyan}B A R N A C L E S${colors.reset}`);
  console.log(`  ${colors.dim}Developer Project Manager${colors.reset}\n`);
}

/**
 * Print a compact branded header
 */
export function printCompactHeader(): void {
  console.log(
    `${compactLogo} ${colors.bold}Barnacles${colors.reset} ${colors.dim}CLI${colors.reset}\n`
  );
}
