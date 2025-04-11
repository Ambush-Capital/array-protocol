# [programs.localnet]
# drift = "DftNc7gwihkEEwQRpu4bV89N18xpNEuBVg7YkhTZZhVo"
# pyth = "6waQExJNwB5Cv4YwiH4kkNkH5JKUd7nDvWz4bNf5ecJR"
# token_faucet = "HdQEy3fzqHoNPYyAFmnUJnVqd8frP5jkWR4Lk623VaPp"


# [provider]
# cluster = "localnet"
# wallet = "~/.config/solana/drift-local-key.json"

#!/bin/bash
set -e  # Exit on error

# Determine the project root directory (where .env is located)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load environment variables from .env file
source "$PROJECT_ROOT/.env"

echo "=== Starting Drift build process ==="

# Step 1: Check if Drift is checked out
if [ ! -d "$DRIFT_REPO_PATH" ]; then
    echo "Drift repository not found. Cloning from $DRIFT_REPO_URL..."
    git clone $DRIFT_REPO_URL $DRIFT_REPO_PATH
    cd $DRIFT_REPO_PATH
else
    echo "Drift repository found at $DRIFT_REPO_PATH"
    cd $DRIFT_REPO_PATH
    
    # Step 2: Clear changes and pull latest
    echo "Cleaning existing repository..."
    git reset --hard HEAD
    git clean -fd
    git fetch --all
fi

# Step 3: Checkout the specific tag
echo "Checking out tag $DRIFT_REPO_TAG..."
git checkout $DRIFT_REPO_TAG

# Step 4: Replace program IDs in all files
echo "Replacing program IDs (mainnet -> local)..."
# Detect OS for sed compatibility
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS requires an empty string with -i
    echo "Updating program IDs in programs directory..."
    find ./programs -type f -not -path "*/target/*" -not -path "*/node_modules/*" -exec sed -i '' "s/$DRIFT_PROGRAM_ID_MAINNET/$DRIFT_PROGRAM_ID_LOCAL/g" {} \;
    
    # Explicitly update Anchor.toml
    echo "Explicitly updating Anchor.toml..."
    if [ -f "Anchor.toml" ]; then
        sed -i '' "s/drift = \"$DRIFT_PROGRAM_ID_MAINNET\"/drift = \"$DRIFT_PROGRAM_ID_LOCAL\"/g" Anchor.toml
    fi
else
    # Linux version
    echo "Updating program IDs in programs directory..."
    find ./programs -type f -not -path "*/target/*" -not -path "*/node_modules/*" -exec sed -i "s/$DRIFT_PROGRAM_ID_MAINNET/$DRIFT_PROGRAM_ID_LOCAL/g" {} \;
    
    # Explicitly update Anchor.toml
    echo "Explicitly updating Anchor.toml..."
    if [ -f "Anchor.toml" ]; then
        sed -i "s/drift = \"$DRIFT_PROGRAM_ID_MAINNET\"/drift = \"$DRIFT_PROGRAM_ID_LOCAL\"/g" Anchor.toml
    fi
fi

# Step 4.5: Create .envrc file
export PATH="$HOME/tools/solana-v1.18.26/bin:$HOME/tools/anchor-v0.29.0:$PATH"

# Step 5: Install Anchor v0.29.0
echo "Checking Anchor v0.29.0..."
anchor --version

# Step 6: Build Anchor project
echo "Building Anchor project..."
CFLAGS="-isystem /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include" anchor build

# Step 7: Copy the build artifact
echo "Copying build artifact to $DRIFT_PROGRAM_BINARY..."
mkdir -p $PROGRAMS_DIR
cp ./target/deploy/drift.so $DRIFT_PROGRAM_BINARY

echo "=== Drift build completed successfully! ==="
echo "Program binary saved to $DRIFT_PROGRAM_BINARY"