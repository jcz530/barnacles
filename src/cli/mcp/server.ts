import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/index.js';
import { instrumentServer } from './instrumentation.js';
import { eventReporter } from './event-reporter.js';
import { detectCurrentTerminal } from '../utils/terminal-detector.js';

export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: 'barnacles',
      version: '1.0.0',
    },
    {
      instructions:
        'Some users refer to their "projects" as "barnacles" (a play on the app name). ' +
        'If a user asks about "my barnacles", "tell me about my barnacles", etc., treat ' +
        '"barnacles" as a synonym for "projects" and use these tools accordingly.',
    }
  );

  const tools = registerTools(server);

  // Records tool usage so the app's MCP page can show what agents actually use.
  // Failures here are swallowed and never affect a tool call.
  instrumentServer(tools, eventReporter);

  return server;
}

/**
 * The directory the client was launched from.
 *
 * Clients spawn the server with their own cwd, so this is the project the user
 * is actually working in. `process.cwd()` throws if that directory has since
 * been deleted or become unreadable, and this runs before `connect()` — letting
 * it escape would take down the whole server rather than lose one field.
 */
function currentWorkingDir(): string | null {
  try {
    return process.cwd();
  } catch {
    return null;
  }
}

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();

  // Where the call came from. Known immediately, unlike the client identity
  // below, which has to wait for the handshake.
  eventReporter.setEnvironment(currentWorkingDir(), detectCurrentTerminal());

  // Capture which client connected (Claude Code, Cursor, …) once the handshake
  // completes, so usage can be attributed rather than anonymous.
  server.server.oninitialized = () => {
    const client = server.server.getClientVersion();
    eventReporter.setClient(client?.name, client?.version);
  };

  eventReporter.registerExitHandlers();

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
