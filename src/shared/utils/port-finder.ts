import { createServer } from 'node:net';

export interface PortOptions {
  startPort?: number;
  endPort?: number;
}

export const findAvailablePort = async (options: PortOptions = {}): Promise<number> => {
  const { startPort = 3000, endPort = 65535 } = options;

  for (let port = startPort; port <= endPort; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No available port found between ${startPort} and ${endPort}`);
};

export const isPortAvailable = (port: number): Promise<boolean> => {
  return new Promise(resolve => {
    const server = createServer();

    // Set up error handler before calling listen
    server.on('error', () => {
      resolve(false);
    });

    // Bind to :: (all IPv6 addresses, which typically includes IPv4-mapped addresses)
    // Using :: is more comprehensive than 0.0.0.0 as it usually covers both IPv4 and IPv6
    // If IPv6 is not available, we'll fall back to checking IPv4
    server.listen(port, 'localhost', () => {
      server.once('close', () => {
        resolve(true);
      });
      server.close();
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
