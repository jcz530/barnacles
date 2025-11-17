#!/bin/bash
# Barnacles CLI Wrapper
# This script runs the CLI using Electron's embedded Node.js to ensure
# native modules work correctly with the compiled version

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# In production, find the Electron app
ELECTRON_APP="/Applications/Barnacles.app/Contents/MacOS/Barnacles"
CLI_SCRIPT="/Applications/Barnacles.app/Contents/Resources/app.asar.unpacked/dist/cli/index.js"

# Check if we're in development mode
if [ ! -f "$ELECTRON_APP" ]; then
    # Development mode - use system node
    exec node "$SCRIPT_DIR/index.js" "$@"
else
    # Production mode - use Electron's Node.js via ELECTRON_RUN_AS_NODE
    export ELECTRON_RUN_AS_NODE=1
    exec "$ELECTRON_APP" "$CLI_SCRIPT" "$@"
fi
