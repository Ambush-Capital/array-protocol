//! # Drift Account Extractor
//!
//! This tool extracts and transforms Drift accounts from Solana mainnet
//! to be compatible with a local deployment of the Drift protocol.
//!
//! ## Purpose
//!
//! When testing Drift locally (especially for CPI operations like deposits
//! and withdrawals to USDC vaults), we need to:
//!
//! 1. Deploy Drift with a program ID where we have the private key
//! 2. Recreate all accounts with correct PDAs derived from the new program ID
//! 3. Update account owners and internal references
//!
//! This tool automates that process by:
//!
//! - Fetching accounts from mainnet
//! - Transforming them to work with a local deployment
//! - Saving them to JSON files that can be loaded in a local validator
//!
//! ## Usage
//!
//! ```
//! account-extractor --program-id <PROGRAM_ID> --output-dir <OUTPUT_DIR>
//! ```
//!
//! For token accounts:
//!
//! ```
//! account-extractor --wallet <WALLET_ADDRESS> --output-dir <OUTPUT_DIR>
//! ```

mod config;
mod drift_idl;
mod extractorv2;
mod pda;
mod processors;
mod types;
mod utils;

use anyhow::Result;
use config::Config;
use env_logger::Env;
use extractorv2::AccountExtractor2;
use log::info;

// Replace the tokio::main attribute with explicit runtime creation
fn main() -> Result<()> {
    // Initialize logger
    env_logger::Builder::from_env(Env::default().default_filter_or("info")).init();

    info!("Starting Solana account extractor");

    // Parse configuration
    let config = Config::new()?;

    // Create and run extractor
    let extractor = AccountExtractor2::new(config);

    // Create and run the tokio runtime manually
    let rt = tokio::runtime::Runtime::new()?;
    rt.block_on(async { extractor.extract_accounts().await })?;

    info!("Account extraction completed successfully");
    Ok(())
}
