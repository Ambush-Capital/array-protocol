#!/bin/bash

# Determine the project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Session name
SESSION_NAME="array-validator"

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "tmux is not installed. Please install it first."
    exit 1
fi

# Kill existing session if it exists
tmux kill-session -t "$SESSION_NAME" 2>/dev/null

# Create a new tmux session
tmux new-session -d -s "$SESSION_NAME" -n "validator" -c "$PROJECT_ROOT"

# Split the window horizontally
tmux split-window -h -t "$SESSION_NAME" -c "$PROJECT_ROOT"

# Configure the layout (equal width)
tmux select-layout -t "$SESSION_NAME" even-horizontal

# Set environment variables for the left pane (explicitly set COPYFILE_DISABLE)
tmux send-keys -t "$SESSION_NAME:0.0" "export COPYFILE_DISABLE=1" C-m

# Add title to left pane (Validator)
tmux send-keys -t "$SESSION_NAME:0.0" "printf '\033]2;Validator & Accounts\033\\'" C-m
tmux send-keys -t "$SESSION_NAME:0.0" "clear" C-m
tmux send-keys -t "$SESSION_NAME:0.0" "echo '=== DRIFT VALIDATOR & ACCOUNTS ==='" C-m
tmux send-keys -t "$SESSION_NAME:0.0" "echo 'Step 1: Extracting accounts...'" C-m
tmux send-keys -t "$SESSION_NAME:0.0" "cd $PROJECT_ROOT && make extract-accounts-full" C-m

# Configure the right pane to run build, deploy and tests, then exit after 30 seconds
tmux send-keys -t "$SESSION_NAME:0.1" "printf '\033]2;Build, Deploy & Test\033\\'" C-m
tmux send-keys -t "$SESSION_NAME:0.1" "clear" C-m
tmux send-keys -t "$SESSION_NAME:0.1" "echo '=== DRIFT BUILD, DEPLOY & TEST ==='" C-m
tmux send-keys -t "$SESSION_NAME:0.1" "echo 'Waiting for validator to start...'" C-m
tmux send-keys -t "$SESSION_NAME:0.1" "cd $PROJECT_ROOT && make build-and-deploy-drift; echo ''; echo 'Deployment completed. This window will close in 30 seconds...'; sleep 30; exit" C-m

# Set up hook to start validator after extraction completes with COPYFILE_DISABLE=1
tmux send-keys -t "$SESSION_NAME:0.0" "; echo ''; echo 'Step 2: Starting validator...'; COPYFILE_DISABLE=1 make run-validator" C-m

# Attach to the session
tmux attach-session -t "$SESSION_NAME" 