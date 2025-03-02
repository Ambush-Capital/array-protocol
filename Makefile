.PHONY: build-programs build-utils extract-accounts-full clean help run-validator test-drift deploy-drift deploy-funder build-and-deploy-drift initialize-validator

# Default target
.DEFAULT_GOAL := help

# Include .env file if it exists
-include .env

# Account extractor binary path
ACCOUNT_EXTRACTOR = utils/account-extractor/target/debug/account-extractor

# Full output directory paths
DRIFT_FIXTURES_DIR = $(PROJECT_FIXTURES_DIR)/$(DRIFT_OUTPUT_DIR)
USDC_FIXTURES_DIR = $(PROJECT_FIXTURES_DIR)/$(USDC_OUTPUT_DIR)

# Build all Anchor programs
build-programs:
	@echo "Building Anchor programs..."
	anchor build

# Build the account extractor utility
build-utils:
	@echo "Building account extractor utility..."
	cd utils/account-extractor && cargo build --bin account-extractor
	@if [ ! -f "$(ACCOUNT_EXTRACTOR)" ]; then \
		echo "Error: Binary not found at $(ACCOUNT_EXTRACTOR)"; \
		echo "Check that the build succeeded and the binary was created."; \
		exit 1; \
	fi

# Extract Drift accounts with PDA conversion
extract-accounts-full: build-utils
	@echo "Extracting Drift accounts..."
	@mkdir -p $(DRIFT_FIXTURES_DIR)
	$(ACCOUNT_EXTRACTOR) -u "$(SOLANA_RPC_URL)" -p "$(DRIFT_PROGRAM_ID_MAINNET)" -o "$(DRIFT_FIXTURES_DIR)" --convert-pdas
	@echo "Extracting USDC accounts..."
	@mkdir -p $(USDC_FIXTURES_DIR)
	$(ACCOUNT_EXTRACTOR) -u "$(SOLANA_RPC_URL)" -w "$(WALLET_ADDRESS)" -o "$(USDC_FIXTURES_DIR)"
	@echo "Extracting oracle account 9VCioxmni2gDLv11qufWzT3RDERhQE4iY5Gf7NTfYyAV..."
	$(ACCOUNT_EXTRACTOR) -u "$(SOLANA_RPC_URL)" -a "9VCioxmni2gDLv11qufWzT3RDERhQE4iY5Gf7NTfYyAV" -o "$(DRIFT_FIXTURES_DIR)"
	@echo "Extraction complete. Use 'make run-validator' to start a validator with these accounts."

# Deploy Drift program to local validator
deploy-drift:
	@echo "Deploying Drift program to local validator..."
	@mkdir -p $(PROGRAMS_DIR)
	@chmod +x scripts/run-validator/deploy-drift.sh
	scripts/run-validator/deploy-drift.sh

# Test Drift SDK with local validator
check-drift: build-test-scripts
	@echo "Running Drift SDK test..."
	cd scripts/test-validator && node --no-deprecation dist/index.js

# Check wallet balance
check-wallet: build-test-scripts
	@echo "Checking wallet balance..."
	cd scripts/test-validator && RPC_URL="$(SOLANA_RPC_URL)" WALLET_ADDRESS="$(WALLET_ADDRESS)" node --no-deprecation dist/check-wallet-simple.js

# Deposit USDC to Drift
check-deposit-usdc: build-test-scripts
	@echo "Depositing USDC to Drift..."
	cd scripts/test-validator && RPC_URL="$(SOLANA_RPC_URL)" WALLET_ADDRESS="$(WALLET_ADDRESS)" node --no-deprecation dist/deposit-usdc.js

# Build test scripts
build-test-scripts:
	@echo "Building test scripts..."
	cd scripts/test-validator && npm install && npx tsc

# Run all tests
run-tests: check-drift check-wallet check-deposit-usdc
	@echo "All tests completed."

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	anchor clean
	cd utils/account-extractor && cargo clean

# Run the Solana test validator with fixtures
run-validator:
	@echo "Running Solana test validator with fixtures..."
	@mkdir -p $(PROJECT_FIXTURES_DIR)
	@if [ ! -d "$(DRIFT_FIXTURES_DIR)" ]; then \
		echo "Warning: Fixtures directory not found. You may want to run 'make extract-accounts-full' first."; \
	fi
	@chmod +x scripts/run-validator/start.sh
	scripts/run-validator/start.sh

# Fund the deployer account with SOL
deploy-funder:
	@echo "Funding deployer account with SOL..."
	@chmod +x scripts/run-validator/fund-deployer.sh
	scripts/run-validator/fund-deployer.sh

# Build and deploy Drift from protocol repo
build-drift:
	@echo "Building Drift program..."
	@chmod +x scripts/build-drift/build.sh
	scripts/build-drift/build.sh

# Build and deploy Drift 
build-and-deploy-drift: build-drift deploy-drift
	@echo "Drift program built and deployed successfully."

# Initialize validator with tmux interface
initialize-validator:
	@echo "Initializing validator environment with tmux..."
	@chmod +x scripts/run-validator/initialize-tmux.sh
	scripts/run-validator/initialize-tmux.sh

# Help command
help:
	@echo "Available commands:"
	@echo "  make build-programs                  - Build all Anchor programs"
	@echo "  make build-utils                     - Build the account extractor utility"
	@echo "  make extract-accounts-full           - Extract all Drift ecosystem accounts"
	@echo "  make run-validator                   - Run Solana test validator with fixtures"
	@echo "  make deploy-drift                    - Deploy Drift program to local validator"
	@echo "  make build-drift                     - Build Drift from protocol repository"
	@echo "  make build-and-deploy-drift          - Build Drift and deploy to local validator"
	@echo "  make deploy-funder                   - Fund the deployer account with 100 SOL"
	@echo "  make check-drift                     - Test Drift SDK with local validator"
	@echo "  make check-wallet                    - Check wallet balance"
	@echo "  make run-tests                       - Run all tests (drift and wallet check)"
	@echo "  make clean                           - Clean build artifacts"
	@echo "  make initialize-validator            - Initialize validator with tmux interface"
	@echo ""
	@echo "Environment variables (can be set in .env file):"
	@echo "  SOLANA_RPC_URL                - Solana RPC URL for mainnet"
	@echo "  SOLANA_LOCAL_RPC_URL          - Local Solana RPC URL"
	@echo "  DRIFT_PROGRAM_ID_MAINNET      - Drift program ID on mainnet"
	@echo "  DRIFT_PROGRAM_ID_LOCAL        - Drift program ID for local deployment"
	@echo "  WALLET_ADDRESS                - Wallet address for USDC extraction"
	@echo "  PROJECT_FIXTURES_DIR          - Base directory for fixtures"
	@echo "  DRIFT_OUTPUT_DIR              - Directory name for Drift output"
	@echo "  USDC_OUTPUT_DIR               - Directory name for USDC output"
	@echo "  PROGRAMS_DIR                  - Directory for program binaries"
	@echo "  DRIFT_PROGRAM_BINARY          - Path to Drift program binary"
	@echo "  DRIFT_REPO_PATH               - Path to Drift protocol repository" 