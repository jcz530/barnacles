import type { Context, Next } from 'hono';
import { processManagerService } from '../services/process-manager-service';
import { BadRequestException, NotFoundException } from '../exceptions/http-exceptions';
import type { ProcessStatus } from '@shared/types/process';

export type ProcessContext = Context<{
  Variables: {
    process: ProcessStatus & { createdAt?: Date };
  };
}>;

/**
 * Middleware that loads a process by ID from the route parameter
 * and attaches it to the context. If the process is not found,
 * throws a NotFoundException that will be caught by the global error handler.
 *
 * Usage:
 *   app.get('/:id', loadProcess, async (c: ProcessContext) => {
 *     const process = c.get('process');
 *     // process is fully typed and guaranteed to exist here
 *   });
 */
export async function loadProcess(c: ProcessContext, next: Next) {
  const id = c.req.param('id');

  if (!id) {
    throw new BadRequestException('Process ID is required');
  }

  const process = processManagerService.getProcess(id);

  if (!process) {
    throw new NotFoundException('Process not found');
  }

  c.set('process', process);

  await next();
}
