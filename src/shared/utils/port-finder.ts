import { createServer } from 'node:net';

export interface PortOptions {
  startPort?: number;
  endPort?: number;
  host?: string;
}

export const findAvailablePort = async (options: PortOptions = {}): Promise<number> => {
  const { startPort = 3000, endPort = 65535, host = 'localhost' } = options;

  for (let port = startPort; port <= endPort; port++) {
    if (await isPortAvailable(port, host)) {
      return port;
    }
  }

  throw new Error(`No available port found between ${startPort} and ${endPort}`);
};

export const isPortAvailable = (port: number, host = 'localhost'): Promise<boolean> => {
  return new Promise(resolve => {
    const server = createServer();

    server.listen(port, host, () => {
      server.once('close', () => {
        resolve(true);
      });
      server.close();
    });

    server.on('error', () => {
      resolve(false);
    });
  });
};

export const findAvailablePortInRange = async (
  preferredPort: number,
  maxAttempts = 10
): Promise<number> => {
  // Try the preferred port first
  if (await isPortAvailable(preferredPort)) {
    return preferredPort;
  }

  // Try ports around the preferred port
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const portUp = preferredPort + attempt;
    const portDown = preferredPort - attempt;

    // Try incrementing first
    if (portUp <= 65535 && (await isPortAvailable(portUp))) {
      return portUp;
    }

    // Then try decrementing
    if (portDown >= 1024 && (await isPortAvailable(portDown))) {
      return portDown;
    }
  }

  // Fall back to finding any available port in a safe range
  return findAvailablePort({ startPort: 3000, endPort: 4000 });
};
