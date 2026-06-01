#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo
echo "[BangBangCai] Install environment"
echo "--------------------------------"
MIN_NODE_MAJOR=20

need_node=0
if ! command -v node >/dev/null 2>&1; then
  need_node=1
else
  node_major="$(node -p "Number(process.versions.node.split('.')[0])")"
  if [ "$node_major" -lt "$MIN_NODE_MAJOR" ]; then
    need_node=1
    echo "Node.js $(node -v) is too old. Node.js ${MIN_NODE_MAJOR} or newer is required."
  fi
fi

if [ "$need_node" -eq 1 ]; then
  os_name="$(uname -s)"

  if [ "$os_name" = "Darwin" ]; then
    if command -v brew >/dev/null 2>&1; then
      echo "Installing Node.js with Homebrew..."
      brew install node
    else
      echo "Homebrew was not found. Install Node.js LTS manually:"
      echo "https://nodejs.org/"
      echo
      echo "Or install Homebrew first:"
      echo "https://brew.sh/"
      exit 1
    fi
  elif [ -f /etc/debian_version ]; then
    if ! command -v curl >/dev/null 2>&1; then
      echo "Installing curl..."
      sudo apt-get update
      sudo apt-get install -y curl ca-certificates
    fi

    echo "Installing Node.js 20 LTS from NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  else
    echo "Unsupported system for automatic Node.js installation."
    echo "Install Node.js LTS manually: https://nodejs.org/"
    exit 1
  fi
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found after Node.js installation."
  exit 1
fi

node_major="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$node_major" -lt "$MIN_NODE_MAJOR" ]; then
  echo "Node.js is still too old: $(node -v)"
  echo "Please install Node.js ${MIN_NODE_MAJOR}+ and run again."
  exit 1
fi

echo "Node: $(node -v)"
echo "npm:  $(npm -v)"

echo
echo "Installing project dependencies..."
if [ -f package-lock.json ]; then
  echo "Detected package-lock.json, using npm ci..."
  if ! npm ci; then
    echo "npm ci failed, falling back to npm install..."
    npm install
  fi
else
  npm install
fi

echo
echo "Building web files..."
npm run build

echo
echo "Environment is ready."
echo "Use ./scripts/start-booth.sh or ./scripts/start-solo.sh to launch the game."
