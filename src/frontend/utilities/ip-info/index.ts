import type { UtilityRegistration } from '../types';

const registration: UtilityRegistration = {
  metadata: {
    id: 'ip-info',
    name: 'IP Address Info',
    description: 'View your public IP, local IPs, hostname, and network interface details',
    icon: 'Network',
    route: '/utilities/ip-info',
    component: () => import('./IpInfoView.vue'),
    cli: true,
    api: true,
    category: 'Developer Tools',
    tags: ['ip', 'network', 'address', 'hostname', 'interface', 'ipv4', 'ipv6'],
  },
};

export default registration;
