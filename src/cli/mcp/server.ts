import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/index.js';

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

  registerTools(server);

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
