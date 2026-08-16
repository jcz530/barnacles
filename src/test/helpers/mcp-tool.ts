import type { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * `RegisteredTool.handler` is typed as a union of a plain callback and a
 * task-handler object, so TypeScript won't let you call it directly. Every tool
 * in this project registers the callback form, so narrow to that for tests.
 */
type ToolHandler = (
  args: Record<string, unknown>,
  extra: never
) => Promise<{
  isError?: boolean;
  content: Array<{ text?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}>;

/** Get a callable handler for a registered MCP tool. */
export function toolHandler(tool: RegisteredTool): ToolHandler {
  return tool.handler as unknown as ToolHandler;
}
