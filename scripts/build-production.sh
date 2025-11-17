#!/bin/bash
set -e

# Load environment variables from .env file if it exists and vars aren't already set
if [ -f ".env" ] && [ -z "$APPLE_ID" ]; then
  echo "Loading environment variables from .env file..."
  export $(cat .env | grep -v '^#' | xargs)
fi

# Parse arguments
PLATFORM="--mac"
SKIP_SIGN=false

for arg in "$@"; do
  case $arg in
    --mac|--win|--linux)
      PLATFORM="$arg"
      ;;
    --skip-sign)
      SKIP_SIGN=true
      ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: $0 [--mac|--win|--linux] [--skip-sign]"
      exit 1
      ;;
  esac
done

if [ "$SKIP_SIGN" = true ]; then
  echo "⚠️  Building WITHOUT code signing and notarization (faster local build)"
  export CSC_IDENTITY_AUTO_DISCOVERY=false
  export SKIP_NOTARIZE=true
  # For local builds, only create zip (skip DMG which can have permission issues)
  export ELECTRON_BUILDER_ARGS="--mac zip"
else
  echo "Building with code signing and notarization (production build)"
  export ELECTRON_BUILDER_ARGS="$PLATFORM"
fi

echo "Building application..."
npm run build

echo "Setting CLI executable permissions..."
chmod +x dist/cli/index.js

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

if [ "$SKIP_SIGN" = false ]; then
  echo "Installing @electron/notarize for code signing..."
  npm install --no-save @electron/notarize
else
  echo "Skipping @electron/notarize installation (not needed for unsigned builds)"
fi

echo "Creating placeholder directories for missing libsql platform packages..."
mkdir -p node_modules/@libsql/darwin-x64
echo '{"name":"@libsql/darwin-x64","version":"0.0.0"}' > node_modules/@libsql/darwin-x64/package.json

echo "Rebuilding native modules for Electron..."
npx --yes electron-builder install-app-deps

echo "Running electron-builder with args: $ELECTRON_BUILDER_ARGS"
npx --yes electron-builder $ELECTRON_BUILDER_ARGS

echo "Restoring development dependencies..."
rm -rf node_modules
mv package-lock.json.bak package-lock.json
npm ci

echo "Rebuilding native modules for development..."
npm run rebuild

echo "✅ Build complete!"
