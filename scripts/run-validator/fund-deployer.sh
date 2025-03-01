#!/bin/bash

# Set default values
DEPLOY_PAYER_KEYPAIR_PATH=${DEPLOY_PAYER_KEYPAIR_PATH:-"./drift-local-key.json"}
SOLANA_URL=${LOCAL_RPC_URL:-"http://127.0.0.1:8899"}

# Print header
echo "===== Funding Deployment Account ====="
echo "Using payer keypair: $DEPLOY_PAYER_KEYPAIR_PATH"
echo "Solana URL: $SOLANA_URL"
echo "=================================="

# Check if payer keypair exists
if [ ! -f "$DEPLOY_PAYER_KEYPAIR_PATH" ]; then
    echo "Error: Payer keypair not found at $DEPLOY_PAYER_KEYPAIR_PATH"
    echo "Please create a keypair using 'solana-keygen new --no-passphrase -o $DEPLOY_PAYER_KEYPAIR_PATH'"
    echo "or specify an existing keypair path using the DEPLOY_PAYER_KEYPAIR_PATH environment variable."
    exit 1
fi

# Airdrop SOL to the payer keypair
echo "Airdropping 100 SOL to deployment account..."
solana airdrop 100 --keypair "$DEPLOY_PAYER_KEYPAIR_PATH" --url "$SOLANA_URL"

# Check balance
echo "Checking account balance..."
solana balance --keypair "$DEPLOY_PAYER_KEYPAIR_PATH" --url "$SOLANA_URL"