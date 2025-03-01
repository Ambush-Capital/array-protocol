.PHONY: build-programs build-utils extract-accounts-full clean help run-validator test-drift deploy-drift deploy-funder build-and-deploy-drift

# Default target
.DEFAULT_GOAL := help

# Include .env file if it exists
-include .env

# Default RPC URL if not set in .env
RPC_URL ?= https://api.mainnet-beta.solana.com
LOCAL_RPC_URL ?= http://127.0.0.1:8899

# Program ID for extraction (can be overridden from command line)
PROGRAM_ID ?= dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH

# Default wallet address if not set in .env
WALLET_ADDRESS ?= E9rpsfTJQph6Ev4TeEgRubGBaPUbJuoD1VsEYbfqaFXZ

# Drift keypair path
DRIFT_KEYPAIR_PATH ?= ./drift-local-key.json

# Drift program binary path
DRIFT_PROGRAM_PATH ?= ./fixtures/programs/drift.so

# Drift protocol repository path
DRIFT_PROTOCOL_REPO ?= /Users/aaronhenshaw/Documents/github/protocol-v2

# Output directory base
OUTPUT_DIR_BASE ?= fixtures

# Output directory name (defaults to program ID if not specified)
OUTPUT_DIR_NAME ?= drift

# Full output directory path
OUTPUT_DIR = $(OUTPUT_DIR_BASE)/$(OUTPUT_DIR_NAME)

# USDC output directory
USDC_OUTPUT_DIR = $(OUTPUT_DIR_BASE)/usdc

# Account extractor binary path
ACCOUNT_EXTRACTOR = utils/account-extractor/target/debug/account-extractor

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
	@mkdir -p $(OUTPUT_DIR)
	$(ACCOUNT_EXTRACTOR) -u "$(RPC_URL)" -p "$(PROGRAM_ID)" -o "$(OUTPUT_DIR)" --convert-pdas
	@echo "Extracting USDC accounts..."
	@mkdir -p $(USDC_OUTPUT_DIR)
	$(ACCOUNT_EXTRACTOR) -u "$(RPC_URL)" -w "$(WALLET_ADDRESS)" -o "$(USDC_OUTPUT_DIR)"
	@echo "Extracting oracle account 9VCioxmni2gDLv11qufWzT3RDERhQE4iY5Gf7NTfYyAV..."
	$(ACCOUNT_EXTRACTOR) -u "$(RPC_URL)" -a "9VCioxmni2gDLv11qufWzT3RDERhQE4iY5Gf7NTfYyAV" -o "$(OUTPUT_DIR)"
	@echo "Extraction complete. Use 'make run-validator' to start a validator with these accounts."

# Deploy Drift program to local validator
deploy-drift:
	@echo "Deploying Drift program to local validator..."
	@mkdir -p $(OUTPUT_DIR_BASE)/programs
	@chmod +x scripts/run-validator/deploy-drift.sh
	DEPLOY_PAYER_KEYPAIR_PATH="$(DEPLOY_PAYER_KEYPAIR_PATH)" \
	DRIFT_PROGRAM_KEYPAIR_PATH="$(DRIFT_PROGRAM_KEYPAIR_PATH)" \
	DRIFT_PROGRAM_PATH="$(DRIFT_PROGRAM_PATH)" \
	LOCAL_RPC_URL="$(LOCAL_RPC_URL)" \
	scripts/run-validator/deploy-drift.sh

# Test Drift SDK with local validator
check-drift: build-test-scripts
	@echo "Running Drift SDK test..."
	cd scripts/test-validator && node --no-deprecation dist/index.js

# Check wallet balance
check-wallet: build-test-scripts
	@echo "Checking wallet balance..."
	cd scripts/test-validator && RPC_URL="$(RPC_URL)" WALLET_ADDRESS="$(WALLET_ADDRESS)" node --no-deprecation dist/check-wallet-simple.js

# Deposit USDC to Drift
check-deposit-usdc: build-test-scripts
	@echo "Depositing USDC to Drift..."
	cd scripts/test-validator && RPC_URL="$(RPC_URL)" WALLET_ADDRESS="$(WALLET_ADDRESS)" node --no-deprecation dist/deposit-usdc.js

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
	@mkdir -p fixtures
	@if [ ! -d "fixtures/drift" ]; then \
		echo "Warning: Fixtures directory not found. You may want to run 'make extract-accounts-full' first."; \
	fi
	@chmod +x scripts/run-validator/start.sh
	COPYFILE_DISABLE=1 RPC_URL="$(RPC_URL)" scripts/run-validator/start.sh

# Fund the deployer account with SOL
deploy-funder:
	@echo "Funding deployer account with SOL..."
	@chmod +x scripts/run-validator/fund-deployer.sh
	DEPLOY_PAYER_KEYPAIR_PATH="$(DEPLOY_PAYER_KEYPAIR_PATH)" \
	LOCAL_RPC_URL="$(LOCAL_RPC_URL)" \
	scripts/run-validator/fund-deployer.sh

# Build and deploy Drift from protocol repo
build-and-deploy-drift:
	@echo "Building Drift from protocol repository..."
	@cd $(DRIFT_PROTOCOL_REPO) && anchor build
	@echo "Copying Drift program binary to fixtures..."
	@mkdir -p fixtures/programs
	@cp $(DRIFT_PROTOCOL_REPO)/target/deploy/drift.so $(DRIFT_PROGRAM_PATH)
	@echo "Deploying Drift program to local validator..."
	@$(MAKE) deploy-drift

# Help command
help:
	@echo "Available commands:"
	@echo "  make build-programs                                  - Build all Anchor programs"
	@echo "  make build-utils                                     - Build the account extractor utility"
	@echo "  make extract-accounts [PROGRAM_ID=<id>] [OUTPUT_DIR_NAME=<name>] - Extract accounts from a program"
	@echo "  make extract-accounts-full                           - Extract all Drift ecosystem accounts"
	@echo "  make run-validator                                   - Run Solana test validator with fixtures"
	@echo "  make deploy-drift                                    - Deploy Drift program to local validator"
	@echo "  make build-and-deploy-drift                          - Build Drift from protocol repo and deploy to local validator"
	@echo "  make fund-deployer                                   - Fund the deployer account with 100 SOL"
	@echo "  make test-drift                                      - Test Drift SDK with local validator"
	@echo "  make check-wallet                                    - Check wallet balance"
	@echo "  make run-tests                                       - Run all tests (drift and wallet check)"
	@echo "  make clean                                           - Clean build artifacts"
	@echo ""
	@echo "Environment variables (can be set in .env file):"
	@echo "  RPC_URL                - Solana RPC URL (default: $(RPC_URL))"
	@echo "  LOCAL_RPC_URL          - Local Solana RPC URL (default: $(LOCAL_RPC_URL))"
	@echo "  PROGRAM_ID             - Program ID to extract accounts from (default: $(PROGRAM_ID))"
	@echo "  WALLET_ADDRESS         - Wallet address for USDC extraction (default: $(WALLET_ADDRESS))"
	@echo "  DRIFT_KEYPAIR_PATH     - Path to Drift keypair (default: $(DRIFT_KEYPAIR_PATH))"
	@echo "  DRIFT_PROGRAM_PATH     - Path to Drift program binary (default: $(DRIFT_PROGRAM_PATH))"
	@echo "  DRIFT_PROTOCOL_REPO    - Path to Drift protocol repository (default: $(DRIFT_PROTOCOL_REPO))"
	@echo "  OUTPUT_DIR_BASE        - Base directory for output (default: $(OUTPUT_DIR_BASE))"
	@echo "  OUTPUT_DIR_NAME        - Directory name for output (default: $(OUTPUT_DIR_NAME))" 