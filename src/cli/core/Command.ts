/**
 * Abstract base class for CLI commands
 * Inspired by Laravel's command pattern
 */
export abstract class Command {
  /**
   * The name of the command
   */
  abstract readonly name: string;

  /**
   * The description of the command
   */
  abstract readonly description: string;

  /**
   * Optional aliases for the command
   */
  readonly aliases?: string[] = [];

  /**
   * Whether to show intro/outro for this command
   */
  readonly showIntro: boolean = false;

  /**
   * Execute the command
   */
  abstract execute(flags: Record<string, string | boolean>): Promise<void>;

  /**
   * Hook that runs before execute
   */
  protected async beforeExecute(_flags: Record<string, string | boolean>): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Hook that runs after execute
   */
  protected async afterExecute(_flags: Record<string, string | boolean>): Promise<void> {
    // Override in subclasses if needed
  }

  /**
   * Run the command with lifecycle hooks
   */
  async run(flags: Record<string, string | boolean>): Promise<void> {
    await this.beforeExecute(flags);
    await this.execute(flags);
    await this.afterExecute(flags);
  }

  /**
   * Check if a given command name matches this command
   */
  matches(commandName: string): boolean {
    return this.name === commandName || this.aliases?.includes(commandName) || false;
  }
}
