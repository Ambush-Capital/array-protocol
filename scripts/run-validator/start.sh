#!/bin/bash

# Determine the project root directory
COPYFILE_DISABLE=1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load environment variables from .env file
source "$PROJECT_ROOT/.env"

# Set fixture paths
DRIFT_FIXTURES_DIR="$PROJECT_FIXTURES_DIR/$DRIFT_OUTPUT_DIR"
USDC_FIXTURES_DIR="$PROJECT_FIXTURES_DIR/$USDC_OUTPUT_DIR"

# Check if fixtures directory exists
if [ ! -d "$DRIFT_FIXTURES_DIR" ]; then
    echo "Error: Drift fixtures directory not found at $DRIFT_FIXTURES_DIR"
    echo "Please make sure the directory exists or run the account extractor first."
    exit 1
fi

echo "Starting Solana test validator..."
echo "This will clone the following programs:"
echo "  - AmrekAq6s3n2frDi67WUaZnbPkBb1h4xaid1Y8QLMAYN"
echo "  - JCNCMFXo5M5qwUPg2Utu1u6YWp3MbygxqBsBeXXJfrw"
echo "  - $DRIFT_PROGRAM_ID_MAINNET"
echo "  - EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
echo "Using RPC URL: $SOLANA_RPC_URL"
echo "And deploy fixtures from:"
echo "  - Drift: $DRIFT_FIXTURES_DIR"
echo "  - USDC: $USDC_FIXTURES_DIR"

# Start the validator with the specified parameters
solana-test-validator \
    --clone AmrekAq6s3n2frDi67WUaZnbPkBb1h4xaid1Y8QLMAYN \
    --clone JCNCMFXo5M5qwUPg2Utu1u6YWp3MbygxqBsBeXXJfrw \
    --clone "$DRIFT_PROGRAM_ID_MAINNET" \
    --clone EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
    --clone TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA \
    --clone 11111111111111111111111111111111 \
    --reset \
    --ledger \
    --url "$SOLANA_RPC_URL" \
    --account-dir "$USDC_FIXTURES_DIR" \
    --account-dir "$DRIFT_FIXTURES_DIR"

# Note: The --account-dir parameter will load accounts from the specified directory 