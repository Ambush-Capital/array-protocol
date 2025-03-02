//! # Extractor Utilities
//!
//! Common utility functions for the account extractor.

use anyhow::{Context, Result};
use log::info;
use solana_client::rpc_client::RpcClient;
use solana_sdk::account::Account;
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;

/// Parse a string into a Pubkey with helpful error context
///
/// This is used throughout the extractor to convert string addresses
/// to Solana public keys with better error messages.
pub fn parse_pubkey(pubkey_str: &str, context: &str) -> Result<Pubkey> {
    Pubkey::from_str(pubkey_str)
        .with_context(|| format!("Failed to parse {} pubkey: {}", context, pubkey_str))
}

/// Fetch an account by address with helpful error handling
///
/// Retrieves an account from the Solana blockchain with improved error context.
pub async fn fetch_account(client: &RpcClient, pubkey: &Pubkey, context: &str) -> Result<Account> {
    client
        .get_account(pubkey)
        .with_context(|| format!("Failed to fetch {} account: {}", context, pubkey))
}

/// Log an informational message about a found account
///
/// Provides consistent logging format for account discovery.
pub fn log_found_account(account_type: &str, pubkey: &Pubkey) {
    info!("Found {} account: {}", account_type, pubkey);
}

/// Log information about processed accounts
///
/// Provides consistent logging format for account processing results.
pub fn log_processed_accounts(count: usize, account_type: &str) {
    info!("Processed {} {} accounts", count, account_type);
}
