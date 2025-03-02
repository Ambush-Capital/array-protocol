use anyhow::{Context, Result};
use log::{error, info};
use solana_client::rpc_client::RpcClient;
use solana_sdk::account::Account;
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;

/// Parse a string into a Pubkey with helpful error context
pub fn parse_pubkey(pubkey_str: &str, context: &str) -> Result<Pubkey> {
    Pubkey::from_str(pubkey_str)
        .with_context(|| format!("Failed to parse {} pubkey: {}", context, pubkey_str))
}

/// Fetch an account by address with helpful error handling
pub async fn fetch_account(client: &RpcClient, pubkey: &Pubkey, context: &str) -> Result<Account> {
    client
        .get_account(pubkey)
        .with_context(|| format!("Failed to fetch {} account: {}", context, pubkey))
}

/// Log an informational message about a found account
pub fn log_found_account(account_type: &str, pubkey: &Pubkey) {
    info!("Found {} account: {}", account_type, pubkey);
}

/// Log information about processed accounts
pub fn log_processed_accounts(count: usize, account_type: &str) {
    info!("Processed {} {} accounts", count, account_type);
}
