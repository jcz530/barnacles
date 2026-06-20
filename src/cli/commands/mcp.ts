import { Command } from '../core/Command.js';
import { startMcpServer } from '../mcp/server.js';

/**
 * Command to start the Barnacles MCP (Model Context Protocol) server
 *
 * Communicates over stdio, so it must never write to stdout itself —
 * that channel is reserved for the MCP JSON-RPC protocol.
 */
export class McpCommand extends Command {
  readonly name = 'mcp';
  readonly description = 'Start the Barnacles MCP server for use with LLM clients';
  readonly showIntro = false;
  readonly helpText =
    'Starts an MCP server over stdio, allowing LLM clients (e.g. Claude Desktop, Claude Code, Cursor) ' +
    'to query Barnacles project data. Intended to be launched by an MCP client, not run interactively.';
  readonly examples = ['barnacles mcp'];

  async execute(): Promise<void> {
    await startMcpServer();
  }
}
