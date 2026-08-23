import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/index.js';
import { instrumentServer } from './instrumentation.js';
import { eventReporter } from './event-reporter.js';

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

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();

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
