use clap::{Arg, Command};
use solana_sdk::pubkey::Pubkey;
use std::path::PathBuf;
use std::str::FromStr;

/// Configuration for the account extractor
pub struct Config {
    /// Solana RPC URL
    pub rpc_url: String,

    /// Program ID to extract accounts from
    pub program_id: Option<String>,

    /// New program ID to use for remappings
    pub new_program_id: Option<String>,

    /// Single account address to extract
    pub account_address: Option<String>,

    /// Wallet address to extract associated token accounts for
    pub wallet_address: Option<String>,

    /// USDC mint address
    pub usdc_mint: Option<String>,

    /// Output directory for extracted accounts
    pub output_dir: PathBuf,
}

impl Config {
    pub fn new() -> anyhow::Result<Self> {
        let matches = Command::new("Solana Account Extractor")
            .about("Extracts account data from Solana programs")
            .arg(
                Arg::new("url")
                    .short('u')
                    .long("url")
                    .help("Solana RPC URL")
                    .required(true)
                    .value_name("URL"),
            )
            .arg(
                Arg::new("program-id")
                    .short('p')
                    .long("program-id")
                    .help("Program ID to extract accounts from")
                    .conflicts_with("account")
                    .value_name("PUBKEY"),
            )
            .arg(
                Arg::new("account")
                    .short('a')
                    .long("account")
                    .help("Single account address to extract")
                    .conflicts_with("program-id")
                    .value_name("PUBKEY"),
            )
            .arg(
                Arg::new("wallet")
                    .short('w')
                    .long("wallet")
                    .help("Wallet address to extract associated token accounts for")
                    .value_name("PUBKEY"),
            )
            .arg(
                Arg::new("usdc-mint")
                    .short('m')
                    .long("usdc-mint")
                    .help("USDC mint address")
                    .value_name("PUBKEY"),
            )
            .arg(
                Arg::new("output-dir")
                    .short('o')
                    .long("output-dir")
                    .help("Output directory for extracted accounts")
                    .required(true)
                    .value_name("DIR"),
            )
            .arg(
                Arg::new("convert-pdas")
                    .long("convert-pdas")
                    .help("Convert PDAs to use the new program ID")
                    .action(clap::ArgAction::SetTrue),
            )
            .get_matches();

        let rpc_url = matches
            .get_one::<String>("url")
            .ok_or_else(|| anyhow::anyhow!("RPC URL is required"))?
            .clone();

        let program_id = matches.get_one::<String>("program-id").cloned();
        let account_address = matches.get_one::<String>("account").cloned();
        let wallet_address = matches.get_one::<String>("wallet").cloned();
        let usdc_mint = matches.get_one::<String>("usdc-mint").cloned();

        if program_id.is_none() && account_address.is_none() && wallet_address.is_none() {
            return Err(anyhow::anyhow!(
                "Either program-id, account, or wallet must be specified"
            ));
        }

        let output_dir = PathBuf::from(
            matches
                .get_one::<String>("output-dir")
                .ok_or_else(|| anyhow::anyhow!("Output directory is required"))?,
        );

        // Initialize the program configs
        let new_program_id = Some("DftNc7gwihkEEwQRpu4bV89N18xpNEuBVg7YkhTZZhVo".to_string());

        Ok(Config {
            rpc_url,
            program_id,
            account_address,
            wallet_address,
            usdc_mint,
            output_dir,
            new_program_id,
        })
    }

    /// Get the default USDC mint address if none was provided
    pub fn get_usdc_mint(&self) -> &str {
        self.usdc_mint
            .as_deref()
            .unwrap_or("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
    }

    /// Get the new program ID as a Pubkey if one was provided
    pub fn get_new_program_id(&self) -> Option<Pubkey> {
        self.new_program_id
            .as_ref()
            .and_then(|id| Pubkey::from_str(id).ok())
    }
}
