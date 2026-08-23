import { faker } from '@faker-js/faker';
import type { events } from '@shared/database/schema';

type NewEvent = typeof events.$inferInsert;

const TOOL_NAMES = [
  'list_projects',
  'list_ports',
  'get_project_status',
  'start_project_process',
  'get_process_output',
];

/**
 * Generates a realistic usage event for testing
 */
export function createEventData(overrides?: Partial<NewEvent>): NewEvent {
  return {
    source: 'mcp',
    category: 'tool_call',
    name: faker.helpers.arrayElement(TOOL_NAMES),
    status: 'success',
    durationMs: faker.number.int({ min: 1, max: 500 }),
    clientName: faker.helpers.arrayElement(['claude-code', 'cursor-vscode', 'claude-desktop']),
    clientVersion: '1.0.0',
    metadata: JSON.stringify({ args: {} }),
    occurredAt: faker.date.recent({ days: 7 }),
    ...overrides,
  };
}

/**
 * Generates a list of usage events
 */
export function createEventsData(count: number, overrides?: Partial<NewEvent>): NewEvent[] {
  return Array.from({ length: count }, () => createEventData(overrides));
}
