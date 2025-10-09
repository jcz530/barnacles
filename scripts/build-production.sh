#!/bin/bash
set -e

# Get platform argument (defaults to --mac if not specified)
PLATFORM="${1:---mac}"

echo "Building application..."
npm run build

echo "Backing up package-lock.json..."
cp package-lock.json package-lock.json.bak

echo "Removing node_modules..."
rm -rf node_modules

echo "Installing production dependencies..."
npm ci --omit=dev

echo "Verifying production-only install..."
echo "Number of packages installed: $(ls node_modules | wc -l | tr -d ' ')"
if [ -d "node_modules/electron" ]; then
  echo "ERROR: electron (dev dependency) was installed!"
  exit 1
fi

echo "Creating placeholder directories for missing libsql platform packages..."
mkdir -p node_modules/@libsql/darwin-x64
echo '{"name":"@libsql/darwin-x64","version":"0.0.0"}' > node_modules/@libsql/darwin-x64/package.json

echo "Running electron-builder for platform: $PLATFORM"
npx --yes electron-builder "$PLATFORM"

echo "Restoring development dependencies..."
rm -rf node_modules
mv package-lock.json.bak package-lock.json
npm ci

echo "Build complete!"
