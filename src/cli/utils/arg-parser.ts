export interface ParsedArgs {
  command: string | null;
  flags: Record<string, string | boolean>;
}

export function parseArgs(args: string[]): ParsedArgs {
  const command = args[0] && !args[0].startsWith('-') ? args[0] : null;
  const flags: Record<string, string | boolean> = {};

  for (let i = command ? 1 : 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const flagName = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith('-')) {
        flags[flagName] = nextArg;
        i++;
      } else {
        flags[flagName] = true;
      }
    } else if (arg.startsWith('-')) {
      const flagName = arg.slice(1);
      flags[flagName] = true;
    }
  }

  return { command, flags };
}
