import type { Command, CommandContext } from './types';

/**
 * Run a command, and make sure something is said if it throws.
 *
 * Commands report their own outcomes, and the ones that can fail catch their
 * own failures so they can name what went wrong -- "Could not kill port 3000"
 * says more than anything a generic handler could. This is the backstop for
 * the ones that do not: without it a rejected promise is an unhandled
 * rejection, and the palette sits there looking like the keypress missed.
 *
 * That mattered less when every command dismissed -- the palette was gone
 * before the rejection landed. Now that commands stay open, a silent failure
 * is a palette that visibly did nothing.
 *
 * Takes the context as a factory so the caller builds it the same way whether
 * or not the command has a verb to run.
 */
export const runCommand = async (
  command: Command,
  buildContext: () => CommandContext
): Promise<void> => {
  // An item can carry actions instead of a default verb, in which case the
  // palette opens its level rather than running anything here.
  if (!command.run) return;

  const ctx = buildContext();

  try {
    await command.run(ctx);
  } catch (error) {
    // Logged as well as shown: the message is deliberately vague, since
    // reaching here means the command had no opinion about its own failure.
    console.error(`Command "${command.id}" failed`, error);
    ctx.status('Something went wrong', 'error');
  }
};
