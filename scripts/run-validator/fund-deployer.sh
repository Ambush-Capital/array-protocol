#!/bin/bash

# Determine the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load environment variables from .env file
source "$PROJECT_ROOT/.env"

# Print header
echo "===== Funding Deployer Account ====="
echo "Using payer keypair: $DEPLOY_KEYPAIR_PATH"
echo "Solana URL: $SOLANA_LOCAL_RPC_URL"
echo "=================================="

# Check if payer keypair exists
if [ ! -f "$DEPLOY_KEYPAIR_PATH" ]; then
    echo "Error: Payer keypair not found at $DEPLOY_KEYPAIR_PATH"
    echo "Please create a keypair using 'solana-keygen new --no-passphrase -o $DEPLOY_KEYPAIR_PATH'"
    echo "or specify an existing keypair path in .env file."
    exit 1
fi

# Get the payer address
PAYER_ADDRESS=$(solana address -k "$DEPLOY_KEYPAIR_PATH")
echo "Funding address: $PAYER_ADDRESS"

# Airdrop SOL to the payer keypair
echo "Airdropping 100 SOL to deployment account..."
solana airdrop 100 --keypair "$DEPLOY_KEYPAIR_PATH" --url "$SOLANA_LOCAL_RPC_URL"

# Check balance
echo "Checking account balance..."
solana balance --keypair "$DEPLOY_KEYPAIR_PATH" --url "$SOLANA_LOCAL_RPC_URL"

echo "=================================="