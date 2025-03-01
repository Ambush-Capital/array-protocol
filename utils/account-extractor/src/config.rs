use crate::types::{PdaSeedConfig, ProgramExtractorConfig, TokenAccountRemapping};
use clap::{Arg, Command};
use std::collections::HashMap;
use std::path::PathBuf;

/// Configuration for the account extractor
pub struct Config {
    /// Solana RPC URL
    pub rpc_url: String,

    /// Program ID to extract accounts from
    pub program_id: Option<String>,

    /// Single account address to extract
    pub account_address: Option<String>,

    /// Wallet address to extract associated token accounts for
    pub wallet_address: Option<String>,

    /// USDC mint address
    pub usdc_mint: Option<String>,

    /// Output directory for extracted accounts
    pub output_dir: PathBuf,

    /// Map of program IDs to their extraction configurations
    pub program_configs: HashMap<String, ProgramExtractorConfig>,

    /// Whether to convert PDAs to use the new program ID
    pub convert_pdas: bool,
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

        let convert_pdas = matches.get_flag("convert-pdas");

        // Initialize the program configs
        let program_configs = Self::init_program_configs();

        Ok(Config {
            rpc_url,
            program_id,
            account_address,
            wallet_address,
            usdc_mint,
            output_dir,
            program_configs,
            convert_pdas,
        })
    }

    fn init_program_configs() -> HashMap<String, ProgramExtractorConfig> {
        let mut configs = HashMap::new();

        // USDC vault configuration
        let usdc_vault_id = "GXWqPpjQpdz7KZw9p7f5PX2eGxHAhvpNXiviFkAB8zXg".to_string();

        // Create a HashMap for token remappings
        let mut token_remappings = HashMap::new();

        // Add the USDC vault remapping
        token_remappings.insert(
            "6gMq3mRCKf8aP3ttTyYhuijVZ2LGi14oDsBbkgubfLB3".to_string(), // SpotMarket mainnet PDA for USDC
            TokenAccountRemapping {
                original_address: usdc_vault_id.clone(),
                new_owner: Some("HP696aVw2PsHGT89Cc6NiS8ydWw2BAKJA75EsHsjENNJ".to_string()), // New deployer ID as owner
                pda_config: Some(PdaSeedConfig {
                    name: "SpotMarketVault".to_string(),
                    seeds: vec![
                        "spot_market_vault".to_string(),
                        "{market_index}".to_string(),
                    ],
                }),
                market_index: Some(0), // Assuming USDC is market index 0, adjust as needed
                market_reference_account: None, // We're providing the market index directly
            },
        );

        // Drift program configuration
        let drift_program_id = "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH".to_string();
        configs.insert(
            drift_program_id.clone(),
            ProgramExtractorConfig {
                discriminators: vec![
                    [100, 177, 8, 107, 168, 65, 65, 39],    // SpotMarket
                    [216, 146, 107, 94, 104, 75, 182, 177], // State
                    [56, 123, 23, 107, 140, 39, 66, 245],   // SpotMarketVault
                ],
                new_program_id: Some("DftNc7gwihkEEwQRpu4bV89N18xpNEuBVg7YkhTZZhVo".to_string()),
                pda_seeds: vec![
                    // State account PDA - the main program state
                    PdaSeedConfig {
                        name: "State".to_string(),
                        seeds: vec!["drift_state".to_string()],
                    },
                    // Spot Market account PDA
                    PdaSeedConfig {
                        name: "SpotMarket".to_string(),
                        seeds: vec!["spot_market".to_string(), "{market_index}".to_string()],
                    },
                ],
                token_remappings, // Initialize empty for now
            },
        );

        configs
    }

    /// Get the default USDC mint address if none was provided
    pub fn get_usdc_mint(&self) -> &str {
        self.usdc_mint
            .as_deref()
            .unwrap_or("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
    }
}
