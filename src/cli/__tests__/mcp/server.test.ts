import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '@cli/mcp/server.js';

describe('createMcpServer', () => {
  it('registers exactly the two MVP tools', async () => {
    const server = createMcpServer();
    const client = new Client({ name: 'test-client', version: '1.0.0' });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();

    expect(tools.map(t => t.name).sort()).toEqual(['get_project_status', 'list_projects']);
  });
});
