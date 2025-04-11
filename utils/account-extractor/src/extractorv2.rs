//! # Account Extractor for Drift Local Environment
//!
//! This module provides functionality to extract and transform Drift-related accounts from
//! Solana mainnet to be usable in a local validator environment with a custom deployment
//! of the Drift protocol.
//!
//! ## Purpose
//!
//! When deploying Drift locally for testing (especially for CPI operations like deposits
//! and withdrawals to USDC vaults), we need to:
//!
//! 1. Deploy the Drift program from source using an address where we have the private key locally
//! 2. Recreate the necessary account data with correct PDAs derived from the new program ID
//! 3. Modify account owners and internal references to match the new program ID
//! 4. Ensure token accounts (like the USDC vault) have correct ownership for testing
//!
//! ## Key Functionality
//!
//! - Extracts accounts from Solana mainnet based on discriminators
//! - Transforms accounts for local use (updating owners, addresses, and internal references)
//! - Handles special cases like remapping the USDC vault
//! - Processes different account types with specialized processors (SpotMarket, State, Token)
//! - Saves transformed accounts to JSON files for loading into a local validator

use crate::config::Config;
use crate::drift_idl::accounts::{SpotMarket, State};
use crate::pda::types::PdaInfo;
use crate::pda::{PdaGenerator, PdaType};
use crate::processors::{AccountProcessor, SpotMarketProcessor, StateProcessor, TokenProcessor};
use crate::utils::{fetch_account, log_found_account, log_processed_accounts, parse_pubkey};
use anchor_lang::Discriminator;
use anyhow::{Context, Result};
use log::{error, info};
use solana_account_decoder::UiAccountEncoding;
use solana_client::rpc_client::RpcClient;
use solana_client::rpc_config::{RpcAccountInfoConfig, RpcProgramAccountsConfig};
use solana_client::rpc_filter::{Memcmp, RpcFilterType};
use solana_sdk::account::Account;
use solana_sdk::pubkey::Pubkey;
use spl_associated_token_account::get_associated_token_address;
use std::fs;
use std::path::Path;

/// Main extractor for Drift accounts to enable local testing
///
/// `AccountExtractor2` handles fetching, transforming, and saving Drift-related accounts
/// from mainnet so they can be used in a local validator environment with a custom
/// deployment of the Drift protocol (where we have the private key).
pub struct AccountExtractor2 {
    config: Config,
    client: RpcClient,
    new_generator: PdaGenerator,
    spot_market_processor: SpotMarketProcessor,
    state_processor: StateProcessor,
    token_processor: TokenProcessor,
}

impl AccountExtractor2 {
    /// Create a new account extractor with the given configuration
    ///
    /// This initializes the RPC client, PDA generator, and account processors
    /// needed to transform Drift accounts.
    pub fn new(config: Config) -> Self {
        let client = RpcClient::new(&config.rpc_url);
        let new_program_id = config.get_new_program_id().unwrap();

        let new_generator = PdaGenerator::new(&new_program_id);

        let spot_market_processor = SpotMarketProcessor::new(&new_program_id);
        let state_processor = StateProcessor::new(&new_program_id);

        // Create token processor with drift signer PDA
        // This processor is used to update token account authorities to match
        // the new Drift signer derived from our local program ID
        let drift_signer = new_generator.find_pda(PdaType::DriftSigner).address;
        let token_processor = TokenProcessor::new_with_signer(drift_signer);

        Self {
            config,
            client,
            new_generator,
            spot_market_processor,
            state_processor,
            token_processor,
        }
    }

    /// Main entry point for extracting accounts
    ///
    /// This method determines what accounts to extract based on the configuration:
    /// - Program accounts (all Drift accounts associated with a program ID)
    /// - A single account by address
    /// - Token accounts for a wallet address
    pub async fn extract_accounts(&self) -> Result<()> {
        self.ensure_output_dir()?;

        if let Some(program_id_str) = &self.config.program_id {
            // Extract program accounts
            self.extract_program_accounts(program_id_str).await?;
        } else if let Some(account_address) = &self.config.account_address {
            // Extract single account
            info!("Extracting single account: {}", account_address);
            self.extract_single_account(account_address, true).await?;
        } else if let Some(wallet_address) = &self.config.wallet_address {
            // Extract token accounts for wallet
            info!("Extracting token accounts for wallet: {}", wallet_address);
            self.extract_usdc_token_accounts(wallet_address).await?;
            self.extract_single_account(wallet_address, false).await?;
        }

        Ok(())
    }

    // Helper to ensure output directory exists
    fn ensure_output_dir(&self) -> Result<()> {
        let output_dir = &self.config.output_dir;
        fs::create_dir_all(output_dir).context("Failed to create output directory")
    }

    /// Extract token accounts for a wallet
    ///
    /// This is useful for getting USDC token accounts associated with a test wallet
    /// that we have the private key for locally. These accounts will be used for
    /// testing deposit and withdrawal operations with Drift.
    async fn extract_usdc_token_accounts(&self, wallet_address: &str) -> Result<()> {
        // Parse wallet address
        let wallet_pubkey = parse_pubkey(wallet_address, "wallet")?;

        // Get USDC mint
        let usdc_mint_str = self.config.get_usdc_mint();
        let usdc_mint = parse_pubkey(usdc_mint_str, "USDC mint")?;

        // Get the associated token account address
        let token_account_address = get_associated_token_address(&wallet_pubkey, &usdc_mint);

        info!(
            "Associated token account address: {}",
            token_account_address
        );

        // Try to get the token account
        match self.client.get_account(&token_account_address) {
            Ok(account) => {
                // Save the token account
                self.save_account_to_file(&token_account_address, &account)?;
            }
            Err(err) => {
                info!("No associated token account found: {}", err);
            }
        }
        Ok(())
    }

    /// Extract a single account by address
    ///
    /// This method fetches a single account and optionally updates its owner
    /// to the new program ID.
    async fn extract_single_account(
        &self,
        account_address: &str,
        update_owner: bool,
    ) -> Result<()> {
        // Parse account address
        let pubkey = parse_pubkey(account_address, "account")?;

        // Get the account
        info!("Fetching account: {}", pubkey);
        let mut account = fetch_account(&self.client, &pubkey, "single").await?;

        // Check if we need to remap the owner program ID
        self.maybe_update_account_owner(&mut account, update_owner)?;

        // Save the account
        self.save_account_to_file(&pubkey, &account)?;

        Ok(())
    }

    /// Conditionally update an account's owner
    ///
    /// If the account is a program-owned account (not a token account), this will
    /// update its owner to the new program ID. This is necessary for the account
    /// to be usable with our locally deployed version of Drift.
    fn maybe_update_account_owner(&self, account: &mut Account, update_owner: bool) -> Result<()> {
        // Check if we need to remap the owner program ID
        // If it's owned by the token program we want to leave it since it's a top level token account
        let owner_str = account.owner.to_string();
        if owner_str != "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" && update_owner {
            // Not a token account, remap to new program ID
            if let Some(new_program_id) = self.config.get_new_program_id() {
                info!("Remapping owner from {} to {}", owner_str, new_program_id);
                account.owner = new_program_id;
            }
        }
        Ok(())
    }

    /// Extract program accounts
    ///
    /// This method extracts all Drift-related accounts associated with a program ID (assuming that program ID passed in is Drifty...),
    /// transforms them to be compatible with our local deployment, and saves them
    /// to the output directory.
    ///
    /// The accounts are filtered by discriminator to only get the ones we care about:
    /// - SpotMarket accounts (for USDC market)
    /// - State accounts (Drift protocol state)
    /// - Additionally processes the USDC vault remapping
    async fn extract_program_accounts(&self, program_id_str: &str) -> Result<()> {
        // Parse program ID and verify program exists
        let program_id = self.verify_program_exists(program_id_str).await?;
        if program_id.is_none() {
            return Ok(());
        }
        let program_id = program_id.unwrap();

        // Fetch all filtered accounts
        let all_filtered_accounts = self.fetch_program_accounts(&program_id).await?;

        // Process token remappings - this handles the USDC vault token account
        // which is critical for deposit/withdraw operations
        self.process_usdc_vault_remapping().await?;

        // Process different account types
        // State account contains global Drift protocol state and admin/signer references
        self.process_accounts_with_processor(
            &all_filtered_accounts,
            &self.state_processor,
            "State",
        )
        .await?;

        // SpotMarket accounts define markets like USDC
        // We need to update their vault references and owners
        self.process_accounts_with_processor(
            &all_filtered_accounts,
            &self.spot_market_processor,
            "SpotMarket",
        )
        .await?;

        Ok(())
    }

    /// Verify a program exists and return its ID
    async fn verify_program_exists(&self, program_id_str: &str) -> Result<Option<Pubkey>> {
        let program_id = parse_pubkey(program_id_str, "program")?;

        // Check if program exists
        if let Err(e) = self.client.get_account(&program_id) {
            info!("Program {} does not exist: {}", program_id_str, e);
            return Ok(None);
        }

        Ok(Some(program_id))
    }

    /// Fetch accounts filtered by discriminator
    ///
    /// This uses account discriminators (the first 8 bytes of serialized Anchor accounts)
    /// to find specific account types like SpotMarket and State.
    async fn fetch_program_accounts(&self, program_id: &Pubkey) -> Result<Vec<(Pubkey, Account)>> {
        // Use account discriminators to find typed accounts
        let discriminators = [SpotMarket::DISCRIMINATOR, State::DISCRIMINATOR];

        info!("Checking for account types:");
        let mut all_filtered_accounts = Vec::new();

        for (i, discriminator) in discriminators.iter().enumerate() {
            info!("  {}: {:?}", i + 1, discriminator);
            let config = self.create_discriminator_search_config(discriminator);

            let accounts = self
                .client
                .get_program_accounts_with_config(program_id, config)
                .context("Failed to get program accounts")?;

            info!(
                "Found {} accounts with discriminator {:?}",
                accounts.len(),
                discriminator
            );
            all_filtered_accounts.extend(accounts);
        }

        Ok(all_filtered_accounts)
    }

    /// Generic method to process accounts with a given processor
    ///
    /// This method takes a processor implementing the AccountProcessor trait
    /// and applies it to all applicable accounts, saving the results.
    ///
    /// Each processor is responsible for:
    /// 1. Checking if it can handle an account type
    /// 2. Deserializing and modifying the account
    /// 3. Reserializing and returning the modified account with its new address
    async fn process_accounts_with_processor<P: AccountProcessor>(
        &self,
        accounts: &[(Pubkey, Account)],
        processor: &P,
        account_type_name: &str,
    ) -> Result<()> {
        info!("Processing {} accounts...", account_type_name);

        let mut processed_count = 0;

        for (pubkey, account) in accounts {
            if !processor.can_process(account) {
                continue;
            }

            log_found_account(account_type_name, pubkey);

            match processor.process_account(pubkey, account) {
                Ok((new_pubkey, updated_account)) => {
                    self.save_account_to_file(&new_pubkey, &updated_account)?;
                    info!(
                        "Updated and saved {} account: {}",
                        account_type_name, new_pubkey
                    );
                    processed_count += 1;
                }
                Err(err) => {
                    error!("Failed to process {} account: {}", account_type_name, err);
                }
            }
        }

        log_processed_accounts(processed_count, account_type_name);
        Ok(())
    }

    /// Process USDC vault remapping
    ///
    /// This is a critical function that remaps the USDC vault token account.
    /// The USDC vault is used for deposits and withdrawals, so it must be correctly
    /// set up for local testing. This function:
    ///
    /// 1. Gets the original USDC vault address from mainnet
    /// 2. Determines the new vault PDA based on our local program ID
    /// 3. Updates the token account's authority to the new Drift signer
    /// 4. Saves the account with the new address
    async fn process_usdc_vault_remapping(&self) -> Result<()> {
        const USDC_MARKET_INDEX: u16 = 0;

        // Get vault addresses for remapping
        let (original_vault_pubkey, new_vault_pda) =
            self.get_vault_remapping_addresses(USDC_MARKET_INDEX)?;

        // Configure token processor specifically for this vault
        let vault_token_processor = self.create_vault_token_processor(&new_vault_pda.address);

        // Process the vault token account
        self.process_vault_token_account(&original_vault_pubkey, &vault_token_processor)
            .await
    }

    /// Get the original and new vault addresses for remapping
    fn get_vault_remapping_addresses(&self, market_index: u16) -> Result<(Pubkey, PdaInfo)> {
        // Original vault address
        let original_vault = "GXWqPpjQpdz7KZw9p7f5PX2eGxHAhvpNXiviFkAB8zXg";
        let original_vault_pubkey = parse_pubkey(original_vault, "vault")?;

        // Get the new vault PDA
        let new_vault_pda = self
            .new_generator
            .find_pda(PdaType::SpotMarketVault { market_index });

        info!(
            "Remapping USDC spot market vault: {} -> {}",
            original_vault, new_vault_pda.address
        );

        Ok((original_vault_pubkey, new_vault_pda))
    }

    /// Create a token processor configured for a specific vault
    fn create_vault_token_processor(&self, target_vault: &Pubkey) -> TokenProcessor {
        self.token_processor.with_target_vault(*target_vault)
    }

    /// Process a vault token account
    ///
    /// This fetches a token account (like the USDC vault) and processes it
    /// using the provided processor, which updates its authority to match
    /// the new Drift signer.
    async fn process_vault_token_account(
        &self,
        vault_pubkey: &Pubkey,
        processor: &TokenProcessor,
    ) -> Result<()> {
        // Get and process the token account
        let vault_token_account = fetch_account(&self.client, vault_pubkey, "vault token").await?;

        if processor.can_process(&vault_token_account) {
            // Process and save the account
            let (new_pubkey, modified_account) =
                processor.process_account(vault_pubkey, &vault_token_account)?;

            self.save_account_to_file(&new_pubkey, &modified_account)?;
        } else {
            info!("Vault account is not a valid token account - skipping");
        }

        Ok(())
    }

    /// Save an account to a JSON file
    ///
    /// This saves the account data to a JSON file in the configured output
    /// directory. The file format is compatible with the Solana local validator
    /// and can be loaded using --account-dir.
    fn save_account_to_file(&self, pubkey: &Pubkey, account: &Account) -> Result<()> {
        let output_dir = &self.config.output_dir;
        self.save_account_to_directory(pubkey, account, output_dir)
    }

    /// Save an account to a specific directory
    fn save_account_to_directory(
        &self,
        pubkey: &Pubkey,
        account: &Account,
        output_dir: &Path,
    ) -> Result<()> {
        // Format the account data in the requested structure
        let account_json = self.format_account_for_json(pubkey, account);

        // Generate filename and path
        let filename = format!("{}.json", pubkey);
        let file_path = output_dir.join(&filename);

        // Serialize and save
        let json = serde_json::to_string_pretty(&account_json)
            .context("Failed to serialize account data")?;

        fs::write(&file_path, json)
            .with_context(|| format!("Failed to write account data to {}", file_path.display()))?;

        info!("Saved account {} to {}", pubkey, file_path.display());

        Ok(())
    }

    /// Format account data for JSON serialization
    ///
    /// Creates a JSON structure that represents the account in a format
    /// compatible with Solana's local validator.
    fn format_account_for_json(&self, pubkey: &Pubkey, account: &Account) -> serde_json::Value {
        serde_json::json!({
            "pubkey": pubkey.to_string(),
            "account": {
                "lamports": account.lamports,
                "data": [
                    base64::encode(&account.data),
                    "base64"
                ],
                "owner": account.owner.to_string(),
                "executable": account.executable,
                "rentEpoch": account.rent_epoch,
                "space": account.data.len(),
            }
        })
    }

    /// Create a RpcProgramAccountsConfig for a given discriminator
    ///
    /// This configures a filter to find accounts with a specific discriminator.
    /// Anchor uses the first 8 bytes as a discriminator to identify account types.
    fn create_discriminator_search_config(&self, discriminator: &[u8]) -> RpcProgramAccountsConfig {
        // Create a memcmp filter for the discriminator
        let filter = RpcFilterType::Memcmp(Memcmp::new_raw_bytes(
            0, // offset
            discriminator.to_vec(),
        ));

        // Set up the config with proper encoding
        RpcProgramAccountsConfig {
            filters: Some(vec![filter]),
            account_config: RpcAccountInfoConfig {
                encoding: Some(UiAccountEncoding::Base64),
                ..Default::default()
            },
            with_context: None,
        }
    }
}
