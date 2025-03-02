#!/bin/bash

# Script to deploy the Drift program to a local Solana validator

# Determine the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load environment variables from .env file
source "$PROJECT_ROOT/.env"

# Print header
echo "===== Drift Program Deployment ====="
echo "Using payer keypair: $DEPLOY_KEYPAIR_PATH"
echo "Using program keypair: $DRIFT_PROGRAM_KEYPAIR_PATH"
echo "Program binary: $DRIFT_PROGRAM_BINARY"
echo "Solana URL: $SOLANA_LOCAL_RPC_URL"
echo "=================================="

# Check if payer keypair exists
if [ ! -f "$DEPLOY_KEYPAIR_PATH" ]; then
    echo "Error: Payer keypair not found at $DEPLOY_KEYPAIR_PATH"
    echo "Please create a keypair using 'solana-keygen new --no-passphrase -o $DEPLOY_KEYPAIR_PATH'"
    echo "or specify an existing keypair path in .env file."
    exit 1
fi

# Verify the payer keypair is valid
if ! solana address -k "$DEPLOY_KEYPAIR_PATH" &>/dev/null; then
    echo "Error: Invalid payer keypair at $DEPLOY_KEYPAIR_PATH"
    echo "Please provide a valid Solana keypair file."
    exit 1
fi

# Check if program keypair exists
if [ ! -f "$DRIFT_PROGRAM_KEYPAIR_PATH" ]; then
    echo "Error: Program keypair not found at $DRIFT_PROGRAM_KEYPAIR_PATH"
    echo "Please create a keypair using 'solana-keygen new --no-passphrase -o $DRIFT_PROGRAM_KEYPAIR_PATH'"
    echo "or update the path in .env file."
    exit 1
fi

# Get the program ID from the program keypair
PROGRAM_ID=$(solana address -k "$DRIFT_PROGRAM_KEYPAIR_PATH")
echo "Using program ID: $PROGRAM_ID"

# Airdrop SOL to the payer keypair
echo "Airdropping 100 SOL to deployment account..."
solana airdrop 100 --keypair "$DEPLOY_KEYPAIR_PATH" --url "$SOLANA_LOCAL_RPC_URL"

# Check balance
echo "Checking account balance..."
solana balance --keypair "$DEPLOY_KEYPAIR_PATH" --url "$SOLANA_LOCAL_RPC_URL"

# Check if program binary exists
if [ ! -f "$DRIFT_PROGRAM_BINARY" ]; then
    echo "Error: Program binary not found at $DRIFT_PROGRAM_BINARY"
    echo "Please build the program first using 'scripts/build-drift/build.sh'"
    exit 1
fi

# Deploy the program with the program keypair
echo "Deploying Drift program..."
DEPLOY_OUTPUT=$(solana program deploy --program-id "$DRIFT_PROGRAM_KEYPAIR_PATH" --keypair "$DEPLOY_KEYPAIR_PATH" --url "$SOLANA_LOCAL_RPC_URL" "$DRIFT_PROGRAM_BINARY")
echo "$DEPLOY_OUTPUT"

# Extract program ID from deploy output
DEPLOYED_PROGRAM_ID=$(echo "$DEPLOY_OUTPUT" | grep -o 'Program Id: [^ ]*' | cut -d ' ' -f 3)

if [ -n "$DEPLOYED_PROGRAM_ID" ]; then
    echo "Deployment successful!"
    echo "Program ID: $DEPLOYED_PROGRAM_ID"
    
    # Verify the program ID matches what we expect
    if [ "$DEPLOYED_PROGRAM_ID" = "$PROGRAM_ID" ]; then
        echo "✅ Program ID matches expected value from program keypair"
    else
        echo "⚠️ WARNING: Deployed program ID does not match expected value from program keypair!"
        echo "Expected: $PROGRAM_ID"
        echo "Actual: $DEPLOYED_PROGRAM_ID"
        echo "This suggests there might be an issue with the deployment process."
    fi
    
    # Show program details
    echo "Fetching program details..."
    solana program show "$DEPLOYED_PROGRAM_ID" --keypair "$DEPLOY_KEYPAIR_PATH" --url "$SOLANA_LOCAL_RPC_URL"
    
    # Save program ID to a file for reference
    echo "$DEPLOYED_PROGRAM_ID" > drift-program-id.txt
    echo "Program ID saved to drift-program-id.txt"
    
    # Update the environment variable
    echo "DRIFT_PROGRAM_ID_LOCAL=$DEPLOYED_PROGRAM_ID" > drift-program-id.env
    echo "Environment variable saved to drift-program-id.env"
    
    # Provide instructions for updating the config
    echo ""
    echo "To use this program ID in the account extractor, update the new_program_id in config.rs:"
    echo "new_program_id: Some(\"$DEPLOYED_PROGRAM_ID\".to_string()),"
else
    echo "Failed to extract Program ID from deployment output."
    echo "Please check the deployment logs above for errors."
fi

echo "==================================" 