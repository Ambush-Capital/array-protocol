#!/bin/bash

# Set environment variables
COPYFILE_DISABLE=1
FIXTURES_DIR="/Users/aaronhenshaw/Documents/github/array-protocol/fixtures/drift"
FIXTURES_ACCOUNTS_DIR="/Users/aaronhenshaw/Documents/github/array-protocol/fixtures/usdc"

# Get RPC_URL from environment or use default
RPC_URL=${RPC_URL:-"https://api.mainnet-beta.solana.com"}

# Check if fixtures directory exists
if [ ! -d "$FIXTURES_DIR" ]; then
    echo "Error: Fixtures directory not found at $FIXTURES_DIR"
    echo "Please make sure the directory exists or run the account extractor first."
    exit 1
fi

echo "Starting Solana test validator..."
echo "This will clone the following programs:"
echo "  - AmrekAq6s3n2frDi67WUaZnbPkBb1h4xaid1Y8QLMAYN"
echo "  - JCNCMFXo5M5qwUPg2Utu1u6YWp3MbygxqBsBeXXJfrw"
echo "  - dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH"
echo "  - EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
echo "Using RPC URL: $RPC_URL"
echo "And deploy fixtures from $FIXTURES_DIR"

# Start the validator with the specified parameters
solana-test-validator \
    --clone AmrekAq6s3n2frDi67WUaZnbPkBb1h4xaid1Y8QLMAYN \
    --clone JCNCMFXo5M5qwUPg2Utu1u6YWp3MbygxqBsBeXXJfrw \
    --clone dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH \
    --clone EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \
    --clone TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA \
    --clone 11111111111111111111111111111111 \
    --reset \
    --ledger \
    --url "$RPC_URL" \
    --account-dir "$FIXTURES_ACCOUNTS_DIR" \
    --account-dir "$FIXTURES_DIR"

# Note: The --account-dir parameter will load accounts from the specified directory 