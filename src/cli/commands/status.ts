import { compactLogo } from '../utils/branding.js';
import { box, intro, log, note, outro } from '@clack/prompts';

export async function statusCommand(_flags: Record<string, string | boolean>): Promise<void> {
  intro(`${compactLogo} Barnacles`);
  log.message('Hello, World', { symbol: compactLogo });
  // console.log(`${compactLogo} Barnacles is online ✓`);
  log.message(`Barnacles is online ✓`);
  log.info(`Barnacles is online ✓`);
  log.warn(`Barnacles is online ✓`);
  log.warning(`Barnacles is online ✓`);
  log.success(`Barnacles is online ✓`);
  log.error(`Barnacles is online ✓`);
  log.step(`Barnacles is online ✓`);
  box('hey', 'processes', { rounded: true });
  // Database: connected, error
  // Scanner: running, idle
  // Projects: 120
  // Processes
  note('Online', 'Status');
  const data = [
    { name: 'Project A', status: 'Running', port: 3000 },
    { name: 'Project B', status: 'Stopped', port: 3001 },
  ];
  console.table(data);

  // const basket = await autocomplete({
  //   message: 'Select your favorite fruits and vegetables:',
  //   options: [
  //     { value: 'apple', label: 'apple' },
  //     { value: 'banana', label: 'banana' },
  //     { value: 'cherry', label: 'cherry' },
  //   ],
  // });

  outro('Barnacles Status');
}
