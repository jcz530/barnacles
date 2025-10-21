import { Command } from './Command.js';

/**
 * Registry for managing CLI commands
 */
export class CommandRegistry {
  private commands: Command[] = [];

  /**
   * Register a command
   */
  register(command: Command): void {
    this.commands.push(command);
  }

  /**
   * Register multiple commands
   */
  registerMultiple(commands: Command[]): void {
    commands.forEach(command => this.register(command));
  }

  /**
   * Find a command by name or alias
   */
  find(commandName: string): Command | undefined {
    return this.commands.find(cmd => cmd.matches(commandName));
  }

  /**
   * Get all registered commands
   */
  all(): Command[] {
    return this.commands;
  }

  /**
   * Check if a command exists
   */
  has(commandName: string): boolean {
    return this.find(commandName) !== undefined;
  }

  /**
   * Execute a command by name
   */
  async execute(commandName: string, flags: Record<string, string | boolean>): Promise<void> {
    const command = this.find(commandName);

    if (!command) {
      throw new Error(`Unknown command: ${commandName}`);
    }

    await command.run(flags);
  }
}
