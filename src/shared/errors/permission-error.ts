/**
 * Error codes for permission-related issues
 */
export enum PermissionErrorCode {
  APPLE_EVENTS_NOT_AUTHORIZED = 'APPLE_EVENTS_NOT_AUTHORIZED',
  TERMINAL_NOT_AUTHORIZED = 'TERMINAL_NOT_AUTHORIZED',
  IDE_NOT_AUTHORIZED = 'IDE_NOT_AUTHORIZED',
}

/**
 * Generates permission instructions for macOS automation
 */
function getPermissionInstructions(appName: string, action: string): string {
  return (
    `To allow this app to open ${appName}:\n\n` +
    `1. Open System Settings\n` +
    `2. Go to Privacy & Security\n` +
    `3. Scroll down and click on Automation\n` +
    `4. Find Barnacles in the list\n` +
    `5. Enable the checkbox next to ${appName}\n\n` +
    `Then try ${action} again.`
  );
}

/**
 * Custom error class for permission-related issues
 */
export class PermissionError extends Error {
  public readonly code: PermissionErrorCode;
  public readonly targetApp: string;
  public readonly instructions: string;

  constructor(code: PermissionErrorCode, targetApp: string, message: string, instructions: string) {
    super(message);
    this.name = 'PermissionError';
    this.code = code;
    this.targetApp = targetApp;
    this.instructions = instructions;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PermissionError);
    }
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      targetApp: this.targetApp,
      instructions: this.instructions,
    };
  }

  /**
   * Check if an error is a macOS Apple Events permission error
   */
  static isAppleEventsError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('not authorized to send apple events') || message.includes('-1743');
    }
    return false;
  }

  /**
   * Create a permission error for terminal automation
   */
  static createTerminalPermissionError(terminalName: string): PermissionError {
    return new PermissionError(
      PermissionErrorCode.TERMINAL_NOT_AUTHORIZED,
      terminalName,
      `Not authorized to control ${terminalName}`,
      getPermissionInstructions(terminalName, 'opening the terminal')
    );
  }

  /**
   * Create a permission error for IDE automation
   */
  static createIDEPermissionError(ideName: string): PermissionError {
    return new PermissionError(
      PermissionErrorCode.IDE_NOT_AUTHORIZED,
      ideName,
      `Not authorized to control ${ideName}`,
      getPermissionInstructions(ideName, 'opening the IDE')
    );
  }
}
