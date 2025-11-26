import { getCompleteIpInfo } from '../../shared/utilities/ip-info.js';
import { intro, log, outro, spinner } from '@clack/prompts';
import { compactLogo } from '../utils/branding.js';
import pc from 'picocolors';

const SEPARATOR = '─'.repeat(60);

/**
 * Display IP information in a formatted way
 */
async function displayIpInfo() {
  const s = spinner();
  s.start('Fetching IP information...');

  try {
    const ipInfo = await getCompleteIpInfo();
    s.stop('IP information retrieved');

    console.log('\n' + pc.bold('IP Address Information:'));
    console.log(pc.dim(SEPARATOR));

    // Public IP
    if (ipInfo.publicIp) {
      console.log(pc.bold('Public IP:       ') + pc.cyan(ipInfo.publicIp));
    } else {
      console.log(pc.bold('Public IP:       ') + pc.dim('Unable to fetch'));
    }

    // Hostname
    console.log(pc.bold('Hostname:        ') + pc.cyan(ipInfo.hostname));

    // Local IPv4 addresses
    if (ipInfo.localIpv4.length > 0) {
      console.log('\n' + pc.bold('Local IPv4 Addresses:'));
      ipInfo.localIpv4.forEach(ip => {
        console.log('  • ' + pc.cyan(ip));
      });
    }

    // Local IPv6 addresses
    if (ipInfo.localIpv6.length > 0) {
      console.log('\n' + pc.bold('Local IPv6 Addresses:'));
      ipInfo.localIpv6.forEach(ip => {
        console.log('  • ' + pc.cyan(ip));
      });
    }

    // Network interfaces
    if (ipInfo.interfaces.length > 0) {
      console.log('\n' + pc.bold('Network Interfaces:'));
      ipInfo.interfaces.forEach(iface => {
        const badge = iface.internal ? pc.dim('[Internal]') : pc.green('[External]');
        const familyBadge = iface.family === 'IPv4' ? pc.blue('[IPv4]') : pc.magenta('[IPv6]');
        console.log(
          `  ${pc.bold(iface.name.padEnd(12))} ${badge} ${familyBadge} ${pc.cyan(iface.address)}`
        );
      });
    }

    console.log(pc.dim(SEPARATOR) + '\n');
    return true;
  } catch (error) {
    s.stop('Failed to fetch IP information');
    log.error(error instanceof Error ? error.message : 'Unknown error occurred');
    return false;
  }
}

export const ipInfoCli = {
  id: 'ip',
  name: 'IP Address Info',
  description: 'Display your public IP, local IPs, hostname, and network interface details',
  handler: {
    async execute() {
      intro(`${compactLogo} IP Address Information`);
      const success = await displayIpInfo();
      if (success) {
        outro('Done!');
      } else {
        outro('Failed to retrieve IP information');
      }
    },
    helpText: 'Display network and IP address information',
    examples: ['barnacles utilities ip', 'barnacles util ip'],
  },
};
