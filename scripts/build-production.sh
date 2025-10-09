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

echo "Installing production dependencies only..."
npm ci --omit=dev

echo "Creating dummy packages for missing libsql optional dependencies..."
for pkg in darwin-x64 linux-arm-gnueabihf linux-arm-musleabihf linux-arm64-gnu linux-arm64-musl linux-x64-gnu linux-x64-musl win32-x64-msvc; do
  mkdir -p "node_modules/@libsql/$pkg"
  echo "{\"name\":\"@libsql/$pkg\",\"version\":\"0.5.22\"}" > "node_modules/@libsql/$pkg/package.json"
done

echo "Running electron-builder for platform: $PLATFORM"
npx --yes electron-builder "$PLATFORM"

echo "Restoring development dependencies..."
rm -rf node_modules
mv package-lock.json.bak package-lock.json
npm ci

echo "Build complete!"
