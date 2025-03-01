mod config;
mod drift_idl;
mod extractor;
mod pda;
mod types;

use anyhow::Result;
use config::Config;
use env_logger::Env;
use extractor::AccountExtractor;
use log::info;

// Replace the tokio::main attribute with explicit runtime creation
fn main() -> Result<()> {
    // Initialize logger
    env_logger::Builder::from_env(Env::default().default_filter_or("info")).init();

    info!("Starting Solana account extractor");

    // Parse configuration
    let config = Config::new()?;

    // Create and run extractor
    let extractor = AccountExtractor::new(config);

    // Create and run the tokio runtime manually
    let rt = tokio::runtime::Runtime::new()?;
    rt.block_on(async { extractor.extract_accounts().await })?;

    info!("Account extraction completed successfully");
    Ok(())
}
