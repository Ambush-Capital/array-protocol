##
## Array Protocol Development Makefile
##

# Include .env file if it exists
-include .env

# Default target
.DEFAULT_GOAL := help

# Global declarations
.PHONY: help

# Account extractor binary path
ACCOUNT_EXTRACTOR = utils/account-extractor/target/debug/account-extractor

# Full output directory paths
DRIFT_FIXTURES_DIR = $(PROJECT_FIXTURES_DIR)/$(DRIFT_OUTPUT_DIR)
USDC_FIXTURES_DIR = $(PROJECT_FIXTURES_DIR)/$(USDC_OUTPUT_DIR)

##
## BUILD COMMANDS
##

# @description Build all Anchor programs
.PHONY: build-programs
build-programs:
	@echo "Building Anchor programs..."
	anchor build

# @description Build the account extractor utility
.PHONY: build-utils
build-utils:
	@echo "Building account extractor utility..."
	cd utils/account-extractor && cargo build --bin account-extractor
	@if [ ! -f "$(ACCOUNT_EXTRACTOR)" ]; then \
		echo "Error: Binary not found at $(ACCOUNT_EXTRACTOR)"; \
		echo "Check that the build succeeded and the binary was created."; \
		exit 1; \
	fi

# @description Build test scripts
.PHONY: build-test-scripts
build-test-scripts:
	@echo "Building test scripts..."
	cd scripts/test-validator && npm install && npx tsc

# @description Build Drift from protocol repository
.PHONY: build-drift
build-drift:
	@echo "Building Drift program..."
	@chmod +x scripts/build-drift/build.sh
	scripts/build-drift/build.sh

##
## DEPLOYMENT COMMANDS
##

# @description Deploy Drift program to local validator
.PHONY: deploy-drift
deploy-drift:
	@echo "Deploying Drift program to local validator..."
	@mkdir -p $(PROGRAMS_DIR)
	@chmod +x scripts/run-validator/deploy-drift.sh
	scripts/run-validator/deploy-drift.sh

# @description Fund the deployer account with SOL
.PHONY: deploy-funder
deploy-funder:
	@echo "Funding deployer account with SOL..."
	@chmod +x scripts/run-validator/fund-deployer.sh
	scripts/run-validator/fund-deployer.sh

# @description Build Drift and deploy to local validator
.PHONY: build-and-deploy-drift
build-and-deploy-drift: build-drift deploy-drift
	@echo "Drift program built and deployed successfully."

##
## TEST COMMANDS
##

# @description Run Anchor tests with specific version
.PHONY: anchor-test
anchor-test:
	@echo "Running Anchor tests (skipping local validator)..."
	anchor test --skip-local-validator

# @description Test Drift SDK with local validator
.PHONY: check-drift 
check-drift: build-test-scripts
	@echo "Running Drift SDK test..."
	cd scripts/test-validator && node --no-deprecation dist/index.js

# @description Check wallet balance
.PHONY: check-wallet
check-wallet: build-test-scripts
	@echo "Checking wallet balance..."
	cd scripts/test-validator && RPC_URL="$(SOLANA_RPC_URL)" WALLET_ADDRESS="$(WALLET_ADDRESS)" node --no-deprecation dist/check-wallet-simple.js

# @description Deposit USDC to Drift
.PHONY: check-deposit-usdc
check-deposit-usdc: build-test-scripts
	@echo "Depositing USDC to Drift..."
	cd scripts/test-validator && RPC_URL="$(SOLANA_RPC_URL)" WALLET_ADDRESS="$(WALLET_ADDRESS)" KEYPAIR_PATH="$(DEFAULT_KEYPAIR_PATH)" node --no-deprecation dist/deposit-usdc.js

# @description Check Drift state accounts
.PHONY: check-drift-state
check-drift-state: build-test-scripts
	@echo "Checking Drift state accounts..."
	cd scripts/test-validator && node --no-deprecation dist/check-drift-state.js

# @description Check Drift remaining accounts
.PHONY: check-drift-remaining-accounts
check-drift-remaining-accounts: build-test-scripts
	@echo "Checking Drift remaining accounts..."
	cd scripts/test-validator && node --no-deprecation dist/get-drift-remaining-accounts.js	


# @description Run all tests (drift and wallet check)
.PHONY: run-tests
run-tests: check-drift check-wallet check-deposit-usdc
	@echo "All tests completed."

##
## VALIDATOR COMMANDS
##

# @description Extract all Drift ecosystem accounts
.PHONY: extract-accounts-full
extract-accounts-full: build-utils
	@echo "Extracting Drift accounts..."
	@mkdir -p $(DRIFT_FIXTURES_DIR)
	$(ACCOUNT_EXTRACTOR) -u "$(SOLANA_RPC_URL)" -p "$(DRIFT_PROGRAM_ID_MAINNET)" -o "$(DRIFT_FIXTURES_DIR)" --convert-pdas
	@echo "Extracting USDC accounts..."
	@mkdir -p $(USDC_FIXTURES_DIR)
	$(ACCOUNT_EXTRACTOR) -u "$(SOLANA_RPC_URL)" -w "$(WALLET_ADDRESS)" -o "$(USDC_FIXTURES_DIR)"
	@echo "Extracting oracle account 9VCioxmni2gDLv11qufWzT3RDERhQE4iY5Gf7NTfYyAV..."
	$(ACCOUNT_EXTRACTOR) -u "$(SOLANA_RPC_URL)" -a "3m6i4RFWEDw2Ft4tFHPJtYgmpPe21k56M3FHeWYrgGBz" -o "$(DRIFT_FIXTURES_DIR)"
	$(ACCOUNT_EXTRACTOR) -u "$(SOLANA_RPC_URL)" -a "9VCioxmni2gDLv11qufWzT3RDERhQE4iY5Gf7NTfYyAV" -o "$(DRIFT_FIXTURES_DIR)"
	$(ACCOUNT_EXTRACTOR) -u "$(SOLANA_RPC_URL)" -a "6gMq3mRCKf8aP3ttTyYhuijVZ2LGi14oDsBbkgubfLB3" -o "$(DRIFT_FIXTURES_DIR)"
	$(ACCOUNT_EXTRACTOR) -u "$(SOLANA_RPC_URL)" -a "8UJgxaiQx5nTrdDgph5FiahMmzduuLTLf5WmsPegYA6W" -o "$(DRIFT_FIXTURES_DIR)"
	@echo "Extraction complete. Use 'make run-validator' to start a validator with these accounts."

# @description Run Solana test validator with fixtures
.PHONY: run-validator
run-validator:
	@echo "Running Solana test validator with fixtures..."
	@mkdir -p $(PROJECT_FIXTURES_DIR)
	@if [ ! -d "$(DRIFT_FIXTURES_DIR)" ]; then \
		echo "Warning: Fixtures directory not found. You may want to run 'make extract-accounts-full' first."; \
	fi
	@chmod +x scripts/run-validator/start.sh
	scripts/run-validator/start.sh

# @description Initialize validator with tmux interface
.PHONY: initialize-validator
initialize-validator:
	@echo "Initializing validator environment with tmux..."
	@chmod +x scripts/run-validator/initialize-tmux.sh
	scripts/run-validator/initialize-tmux.sh

##
## UTILITY COMMANDS
##

# @description Clean build artifacts
.PHONY: clean
clean:
	@echo "Cleaning build artifacts..."
	anchor clean
	cd utils/account-extractor && cargo clean

##
## HELP
##

# @description Show this help
help:
	@echo "Array Protocol Development Makefile"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@grep -E '^##' Makefile | sed -e 's/##//'
	@echo ""
	@echo "BUILD COMMANDS:"
	@awk '/^\.PHONY: [a-zA-Z0-9_-]+$$/ {phony=$$2} /^# @description / {desc=substr($$0, 16)} /^[a-zA-Z0-9_-]+:/ {if (phony && desc && $$1 ~ phony ":") {gsub(/:/, "", $$1); if ($$1 ~ /^build/) printf "  %-30s %s\n", $$1, desc; phony=""; desc=""}}' Makefile
	@echo ""
	@echo "DEPLOYMENT COMMANDS:"
	@awk '/^\.PHONY: [a-zA-Z0-9_-]+$$/ {phony=$$2} /^# @description / {desc=substr($$0, 16)} /^[a-zA-Z0-9_-]+:/ {if (phony && desc && $$1 ~ phony ":") {gsub(/:/, "", $$1); if ($$1 ~ /^deploy/ || $$1 ~ /fund/) printf "  %-30s %s\n", $$1, desc; phony=""; desc=""}}' Makefile
	@echo ""
	@echo "TEST COMMANDS:"
	@awk '/^\.PHONY: [a-zA-Z0-9_-]+$$/ {phony=$$2} /^# @description / {desc=substr($$0, 16)} /^[a-zA-Z0-9_-]+:/ {if (phony && desc && $$1 ~ phony ":") {gsub(/:/, "", $$1); if (($$1 ~ /^check/ || $$1 ~ /^anchor-test/ || $$1 ~ /^run-tests/) && !($$1 ~ /validator/)) printf "  %-30s %s\n", $$1, desc; phony=""; desc=""}}' Makefile
	@echo ""
	@echo "VALIDATOR COMMANDS:"
	@awk '/^\.PHONY: [a-zA-Z0-9_-]+$$/ {phony=$$2} /^# @description / {desc=substr($$0, 16)} /^[a-zA-Z0-9_-]+:/ {if (phony && desc && $$1 ~ phony ":") {gsub(/:/, "", $$1); if ($$1 ~ /validator/ || $$1 ~ /^extract/ || $$1 ~ /^initialize/) printf "  %-30s %s\n", $$1, desc; phony=""; desc=""}}' Makefile
	@echo ""
	@echo "UTILITY COMMANDS:"
	@awk '/^\.PHONY: [a-zA-Z0-9_-]+$$/ {phony=$$2} /^# @description / {desc=substr($$0, 16)} /^[a-zA-Z0-9_-]+:/ {if (phony && desc && $$1 ~ phony ":") {gsub(/:/, "", $$1); if ($$1 ~ /^clean/ || $$1 ~ /^help/) printf "  %-30s %s\n", $$1, desc; phony=""; desc=""}}' Makefile
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