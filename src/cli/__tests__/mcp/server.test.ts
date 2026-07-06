import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '@cli/mcp/server.js';

describe('createMcpServer', () => {
  it('registers all expected tools', async () => {
    const server = createMcpServer();
    const client = new Client({ name: 'test-client', version: '1.0.0' });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();

    expect(tools.map(t => t.name).sort()).toEqual([
      'convert_color',
      'generate_color_shades',
      'get_hosts_entries',
      'get_process_output',
      'get_project_by_path',
      'get_project_readme',
      'get_project_scripts',
      'get_project_status',
      'kill_port_process',
      'list_ports',
      'list_project_accounts',
      'list_projects',
      'list_running_processes',
      'open_project_accounts',
      'read_exif_data',
      'remove_project_process',
      'start_project_process',
      'stop_project_process',
      'strip_exif_data',
      'upsert_project_process',
    ]);
  });
});
