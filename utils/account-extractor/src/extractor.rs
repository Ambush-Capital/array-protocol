use crate::config::Config;
use crate::drift_idl::accounts::{SpotMarket, State};
use crate::pda::PdaRemapper;
use anchor_lang::{AccountDeserialize, AccountSerialize, Discriminator};
use anyhow::{Context, Result};
use log::info;
use solana_account_decoder::UiAccountEncoding;
use solana_client::rpc_client::RpcClient;
use solana_client::rpc_config::{RpcAccountInfoConfig, RpcProgramAccountsConfig};
use solana_client::rpc_filter::{Memcmp, MemcmpEncodedBytes, RpcFilterType};
use solana_sdk::account::Account;
use solana_sdk::program_pack::Pack;
use solana_sdk::pubkey::Pubkey;
use spl_associated_token_account::get_associated_token_address;
use spl_token::state::Account as TokenAccount;
use std::collections::HashMap;
use std::fs;
use std::str::FromStr;

pub struct AccountExtractor {
    config: Config,
    client: RpcClient,
    pda_remappers: HashMap<String, PdaRemapper>,
}

impl AccountExtractor {
    /// Create a new account extractor with the given configuration
    pub fn new(config: Config) -> Self {
        let client = RpcClient::new(&config.rpc_url);

        // Initialize PDA remappers for each program with a new program ID
        let mut pda_remappers = HashMap::new();
        for (program_id, program_config) in &config.program_configs {
            if let Some(new_program_id) = &program_config.new_program_id {
                if let Ok(remapper) =
                    PdaRemapper::new(program_id, new_program_id, program_config.pda_seeds.clone())
                {
                    pda_remappers.insert(program_id.clone(), remapper);
                }
            }
        }

        Self {
            config,
            client,
            pda_remappers,
        }
    }

    /// Extract accounts from the configured program
    pub async fn extract_accounts(&self) -> Result<()> {
        // Create output directory if it doesn't exist
        let output_dir = &self.config.output_dir;
        fs::create_dir_all(output_dir).context("Failed to create output directory")?;

        // Check which extraction method to use
        if let Some(program_id_str) = &self.config.program_id {
            // Extract program accounts
            self.extract_program_accounts(program_id_str).await?;
        } else if let Some(account_address) = &self.config.account_address {
            // Extract single account
            self.extract_single_account(account_address).await?;
        } else if let Some(wallet_address) = &self.config.wallet_address {
            // Extract token accounts for wallet
            self.extract_token_accounts(wallet_address).await?;
            self.extract_single_account(wallet_address).await?;
        } else {
            return Err(anyhow::anyhow!(
                "Either program ID, account address, or wallet address must be specified"
            ));
        }

        Ok(())
    }

    /// Extract token accounts for a wallet
    async fn extract_token_accounts(&self, wallet_address: &str) -> Result<()> {
        // Parse wallet address
        let wallet_pubkey =
            Pubkey::from_str(wallet_address).context("Failed to parse wallet address")?;

        // Get USDC mint
        let usdc_mint_str = self.config.get_usdc_mint();
        let usdc_mint =
            Pubkey::from_str(usdc_mint_str).context("Failed to parse USDC mint address")?;

        info!(
            "Extracting USDC token account for wallet: {}",
            wallet_address
        );

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

                // Also save the mint account for reference
                if let Ok(mint_account) = self.client.get_account(&usdc_mint) {
                    self.save_account_to_file(&usdc_mint, &mint_account)?;
                    info!("Saved USDC mint account: {}", usdc_mint);
                }

                // Parse and display token balance
                if let Ok(token_account) = TokenAccount::unpack(&account.data) {
                    info!(
                        "USDC balance for wallet {}: {} tokens",
                        wallet_address, token_account.amount
                    );
                }

                info!(
                    "Successfully extracted token account: {}",
                    token_account_address
                );
            }
            Err(err) => {
                info!("No associated token account found: {}", err);
            }
        }

        // Extract System Program account
        let system_program_id = "11111111111111111111111111111111";
        info!("Extracting System Program account: {}", system_program_id);

        let system_pubkey = Pubkey::from_str(system_program_id)
            .context("Failed to parse System Program address")?;

        match self.client.get_account(&system_pubkey) {
            Ok(account) => {
                self.save_account_to_file(&system_pubkey, &account)?;
                info!("Successfully extracted System Program account");

                // Try to get associated token account for wallet with System Program as mint
                // Note: This is unusual as System Program is not a token mint
                info!("Attempting to get associated token account for wallet with System Program as mint");
                let system_token_account =
                    get_associated_token_address(&wallet_pubkey, &system_pubkey);
                info!(
                    "System Program token account address: {}",
                    system_token_account
                );

                if let Ok(token_account) = self.client.get_account(&system_token_account) {
                    self.save_account_to_file(&system_token_account, &token_account)?;
                    info!("Saved System Program token account");
                } else {
                    info!("No token account found for System Program (this is expected)");
                }
            }
            Err(err) => {
                info!("Failed to get System Program account: {}", err);
            }
        }

        Ok(())
    }

    /// Extract program accounts
    async fn extract_program_accounts(&self, program_id_str: &str) -> Result<()> {
        // Parse program ID
        let program_id = Pubkey::from_str(program_id_str).context("Failed to parse program ID")?;

        // Verify program exists
        info!("Verifying program exists: {}", program_id);
        let program_account = self
            .client
            .get_account(&program_id)
            .context("Failed to get program account")?;

        info!("Program exists. Executable: {}", program_account.executable);

        // Check if we have configuration for this program
        let accounts = if let Some(program_config) = self.config.program_configs.get(program_id_str)
        {
            if !program_config.discriminators.is_empty() {
                info!(
                    "Using discriminator filters for program: {}",
                    program_id_str
                );

                // Create filters for each discriminator
                let mut all_filtered_accounts = Vec::new();

                for discriminator in &program_config.discriminators {
                    // Create a memcmp filter for the discriminator using the approach from the example
                    let filter = RpcFilterType::Memcmp(Memcmp::new_raw_bytes(
                        0, // offset
                        discriminator.to_vec(),
                    ));

                    // Set up the config with proper encoding
                    let config = RpcProgramAccountsConfig {
                        filters: Some(vec![filter]),
                        account_config: RpcAccountInfoConfig {
                            encoding: Some(UiAccountEncoding::Base64),
                            ..Default::default()
                        },
                        with_context: None,
                    };

                    // Get accounts with this discriminator
                    info!("Fetching accounts with discriminator: {:?}", discriminator);
                    let filtered_accounts = self
                        .client
                        .get_program_accounts_with_config(&program_id, config)
                        .with_context(|| {
                            "Failed to get program accounts with discriminator filter"
                        })?;

                    info!(
                        "Found {} accounts with discriminator {:?}",
                        filtered_accounts.len(),
                        discriminator
                    );
                    all_filtered_accounts.extend(filtered_accounts);
                }

                // Process all accounts
                let mut all_accounts = HashMap::new();
                for (pubkey, account) in &all_filtered_accounts {
                    all_accounts.insert(pubkey.to_string(), account.clone());
                    self.save_account_to_file(pubkey, account)?;
                }

                // Process token remappings
                self.process_token_remappings(&all_accounts).await?;

                // Process SpotMarket accounts
                self.process_spot_market_accounts(&all_accounts).await?;

                self.process_state_account(&all_accounts)?;

                all_filtered_accounts
            } else {
                // No discriminators, get all program accounts
                info!(
                    "No discriminators configured for program: {}",
                    program_id_str
                );
                info!("Fetching all accounts for program: {}", program_id);
                self.client
                    .get_program_accounts(&program_id)
                    .context("Failed to get program accounts")?
            }
        } else {
            // No configuration, get all program accounts
            info!("No configuration for program: {}", program_id_str);
            info!("Fetching all accounts for program: {}", program_id);
            self.client
                .get_program_accounts(&program_id)
                .context("Failed to get program accounts")?
        };

        info!("Found {} accounts to process", accounts.len());

        Ok(())
    }

    /// Extract a single account
    async fn extract_single_account(&self, account_address: &str) -> Result<()> {
        // Parse account address
        let pubkey =
            Pubkey::from_str(account_address).context("Failed to parse account address")?;

        // Get the account
        info!("Fetching account: {}", pubkey);
        let account = self
            .client
            .get_account(&pubkey)
            .context("Failed to get account")?;

        // Check if this is a program account that we want to remap
        let mut remapped_pubkey = pubkey;
        for (program_id, program_config) in &self.config.program_configs {
            if program_id == account_address && program_config.new_program_id.is_some() {
                // This is the program account itself and we want to remap it
                if let Some(new_program_id) = &program_config.new_program_id {
                    if self.config.convert_pdas {
                        let new_pubkey = Pubkey::from_str(new_program_id)?;
                        info!("Remapping program ID from {} to {}", pubkey, new_pubkey);
                        remapped_pubkey = new_pubkey;
                    }
                }
                break;
            }
        }

        // Save the account with potentially remapped pubkey
        let accounts = vec![(remapped_pubkey, account)];
        self.save_accounts(&accounts).await?;

        Ok(())
    }

    /// Save accounts
    async fn save_accounts(&self, accounts: &[(Pubkey, Account)]) -> Result<()> {
        let output_dir = &self.config.output_dir;

        info!("Processing {} accounts...", accounts.len());

        for (i, (pubkey, account)) in accounts.iter().enumerate() {
            self.save_account_to_file(pubkey, account)?;

            // Log progress periodically
            if (i + 1) % 100 == 0 || i == accounts.len() - 1 {
                info!(
                    "Processed {}/{} accounts ({:.1}%)",
                    i + 1,
                    accounts.len(),
                    ((i + 1) as f64 / accounts.len() as f64) * 100.0
                );
            }
        }

        info!(
            "Successfully extracted {} accounts to {}",
            accounts.len(),
            output_dir.display()
        );

        Ok(())
    }

    /// Save a single account to a file
    fn save_account_to_file(&self, pubkey: &Pubkey, account: &Account) -> Result<()> {
        let output_dir = &self.config.output_dir;

        // Check if we need to remap the owner program ID
        let owner_str = account.owner.to_string();
        let remapped_owner =
            if let Some(program_config) = self.config.program_configs.get(&owner_str) {
                if let Some(new_program_id) = &program_config.new_program_id {
                    info!("Remapping owner from {} to {}", owner_str, new_program_id);
                    new_program_id.clone()
                } else {
                    owner_str.clone()
                }
            } else {
                owner_str.clone()
            };

        // Check if we need to remap the account address (PDA)
        let pubkey_str = pubkey.to_string();
        let mut remapped_pubkey = pubkey_str.clone();

        if self.config.convert_pdas {
            if let Some(remapper) = self.pda_remappers.get(&owner_str) {
                if let Ok(Some(new_address)) = remapper.remap_address(&pubkey_str) {
                    info!(
                        "Remapping PDA address from {} to {}",
                        pubkey_str, new_address
                    );
                    remapped_pubkey = new_address;
                }
            }
        }

        // Format the account data in the requested structure
        let account_json = serde_json::json!({
            "pubkey": remapped_pubkey,
            "account": {
                "lamports": account.lamports,
                "data": [
                    base64::encode(&account.data),
                    "base64"
                ],
                "owner": remapped_owner,
                "executable": account.executable,
                "rentEpoch": account.rent_epoch,
                "space": account.data.len()
            }
        });

        let filename = format!("{}.json", remapped_pubkey);
        let file_path = output_dir.join(&filename);

        let json = serde_json::to_string_pretty(&account_json)
            .context("Failed to serialize account data")?;

        fs::write(&file_path, json)
            .with_context(|| format!("Failed to write account data to {}", file_path.display()))?;

        Ok(())
    }

    // After extracting all accounts, process token remappings
    async fn process_token_remappings(
        &self,
        all_accounts: &HashMap<String, Account>,
    ) -> Result<()> {
        info!("Processing token account remappings...");

        for (program_id, program_config) in &self.config.program_configs {
            if program_config.token_remappings.is_empty() {
                info!("No token remappings configured for program {}", program_id);
                continue;
            }

            info!(
                "Processing {} token remappings for program {}",
                program_config.token_remappings.len(),
                program_id
            );

            for (reference_account, remapping) in &program_config.token_remappings {
                // Check if we have the reference account
                if !all_accounts.contains_key(reference_account) {
                    info!(
                        "Reference account {} not found, skipping remapping",
                        reference_account
                    );
                    continue;
                }

                // Fetch the original token account from the chain
                let original_address = Pubkey::from_str(&remapping.original_address)?;
                info!("Fetching original token account: {}", original_address);

                let token_account = match self.client.get_account(&original_address) {
                    Ok(account) => account,
                    Err(err) => {
                        info!(
                            "Failed to fetch token account {}: {}",
                            original_address, err
                        );
                        continue;
                    }
                };

                // Determine market index
                let market_index = if let Some(index) = remapping.market_index {
                    index
                } else if let Some(ref_acct) = &remapping.market_reference_account {
                    // Here you would extract the market index from the reference account
                    // This is a placeholder - you'll need to implement the actual logic
                    info!(
                        "Extracting market index from reference account {}",
                        ref_acct
                    );
                    0 // Placeholder
                } else {
                    info!(
                        "No market index specified for {}, using default 0",
                        remapping.original_address
                    );
                    0 // Default
                };

                info!(
                    "Using market index {} for token account {}",
                    market_index, remapping.original_address
                );

                // Generate new PDA address if we have a PDA config
                if let Some(pda_config) = &remapping.pda_config {
                    let market_index_bytes = market_index.to_le_bytes();

                    // Replace {market_index} with the actual value
                    let mut dynamic_seeds = Vec::new();
                    for seed in &pda_config.seeds {
                        if seed == "{market_index}" {
                            dynamic_seeds.push(&market_index_bytes[..]);
                        } else {
                            dynamic_seeds.push(seed.as_bytes());
                        }
                    }

                    // Get the new program ID to use for the PDA
                    let new_program_id_str = if let Some(new_id) = &program_config.new_program_id {
                        new_id
                    } else {
                        program_id
                    };

                    let new_program_id = Pubkey::from_str(new_program_id_str)?;

                    // Generate the new PDA
                    let (new_address, _bump) =
                        Pubkey::find_program_address(&dynamic_seeds, &new_program_id);

                    info!(
                        "Remapping token account {} to new PDA {}",
                        remapping.original_address, new_address
                    );

                    // Create a modified token account with the new owner if specified
                    let mut modified_account = token_account.clone();

                    if let Some(new_owner) = &remapping.new_owner {
                        // Deserialize the token account data
                        match TokenAccount::unpack(&token_account.data) {
                            Ok(mut token) => {
                                // Get the new owner pubkey
                                let new_owner_pubkey = Pubkey::from_str(new_owner)?;

                                info!(
                                    "Changing token account authority from {} to {}",
                                    token.owner, new_owner_pubkey
                                );

                                // Update the token account owner
                                token.owner = new_owner_pubkey;

                                // Reserialize the token account data
                                let mut new_data = vec![0; TokenAccount::LEN];
                                TokenAccount::pack(token, &mut new_data)?;

                                // Update the account data
                                modified_account.data = new_data;
                            }
                            Err(err) => {
                                info!(
                                    "Failed to deserialize token account {}: {}",
                                    remapping.original_address, err
                                );
                                continue;
                            }
                        }
                    }

                    // Save the modified account with the new address
                    self.save_account_to_file(&new_address, &modified_account)?;
                }
            }
        }

        Ok(())
    }

    /// Process SpotMarket accounts to update their internal addresses
    async fn process_spot_market_accounts(
        &self,
        all_accounts: &HashMap<String, Account>,
    ) -> Result<()> {
        info!("Processing SpotMarket accounts...");

        // Find all SpotMarket accounts
        for (pubkey_str, account) in all_accounts {
            // Check if this is a SpotMarket account by looking at the discriminator
            if account.data.len() < 8 {
                continue;
            }

            // Check if this account belongs to a program we're remapping
            let owner_str = account.owner.to_string();
            let program_config = match self.config.program_configs.get(&owner_str) {
                Some(config) => config,
                None => continue,
            };

            // Check if we have a new program ID to remap to
            let new_program_id = match &program_config.new_program_id {
                Some(id) => id,
                None => continue,
            };

            if account.data[0..8] != SpotMarket::DISCRIMINATOR {
                continue;
            }

            info!("Found SpotMarket account: {}", pubkey_str);

            // Try to deserialize the SpotMarket account
            match SpotMarket::try_deserialize(&mut &account.data[..]) {
                Ok(mut spot_market) => {
                    let market_index = spot_market.market_index;
                    info!(
                        "Extracted market index {} from SpotMarket PDA",
                        market_index
                    );

                    // Generate new vault PDA directly
                    let vault_str = spot_market.vault.to_string();
                    let new_vault =
                        self.generate_new_spot_market_vault_pda(market_index, new_program_id)?;
                    info!("Remapping vault from {} to {}", vault_str, new_vault);
                    spot_market.vault = Pubkey::from_str(&new_vault)?;

                    // Generate new SpotMarket PDA address
                    let new_address =
                        self.generate_new_spot_market_pda(market_index, new_program_id)?;
                    spot_market.pubkey = Pubkey::from_str(&new_address)?;

                    // Create a new account with the updated data
                    let mut new_account = account.clone();

                    // Serialize the updated SpotMarket
                    let mut buffer = Vec::new();
                    spot_market.try_serialize(&mut buffer)?;

                    new_account.data = buffer;
                    new_account.owner = Pubkey::from_str(new_program_id)?;

                    // Save the updated account
                    self.save_account_to_file(&Pubkey::from_str(&new_address)?, &new_account)?;
                    info!("Updated and saved SpotMarket account: {}", new_address);
                }
                Err(err) => {
                    info!(
                        "Failed to deserialize SpotMarket account {}: {}",
                        pubkey_str, err
                    );
                }
            }
        }

        Ok(())
    }

    /// Extract market index from a SpotMarket PDA
    fn extract_market_index_from_spot_market(
        &self,
        pubkey_str: &str,
        program_id_str: &str,
    ) -> Result<Option<u16>> {
        let pubkey = Pubkey::from_str(pubkey_str)?;
        let program_id = Pubkey::from_str(program_id_str)?;

        // Try market indices from 0 to 50 until we find a match
        for i in 0..50u16 {
            let market_index_bytes = i.to_le_bytes();
            let seeds = &["spot_market".as_bytes(), &market_index_bytes[..]];

            let (derived_address, _) = Pubkey::find_program_address(seeds, &program_id);

            if derived_address == pubkey {
                return Ok(Some(i));
            }
        }

        Ok(None)
    }

    /// Generate a new SpotMarket PDA address
    fn generate_new_spot_market_pda(
        &self,
        market_index: u16,
        new_program_id: &str,
    ) -> Result<String> {
        let new_program_pubkey = Pubkey::from_str(new_program_id)?;
        let market_index_bytes = market_index.to_le_bytes();

        let seeds = &["spot_market".as_bytes(), &market_index_bytes[..]];

        let (new_address, _) = Pubkey::find_program_address(seeds, &new_program_pubkey);

        Ok(new_address.to_string())
    }

    /// Generate a new SpotMarket vault PDA address
    fn generate_new_spot_market_vault_pda(
        &self,
        market_index: u16,
        new_program_id: &str,
    ) -> Result<String> {
        let new_program_pubkey = Pubkey::from_str(new_program_id)?;
        let market_index_bytes = market_index.to_le_bytes();

        let seeds = &["spot_market_vault".as_bytes(), &market_index_bytes[..]];

        let (new_address, _) = Pubkey::find_program_address(seeds, &new_program_pubkey);

        Ok(new_address.to_string())
    }

    /// Process State account to print whitelist mint and update admin/signer
    fn process_state_account(&self, all_accounts: &HashMap<String, Account>) -> Result<()> {
        info!("Looking for State accounts...");

        // The new admin/signer pubkey
        let new_authority = Pubkey::from_str("Gxus3woPgbAPYiqasvr6eoaKAFrpK3vpmJG7kBfU9gCn")?;

        for (pubkey_str, account) in all_accounts {
            // Check if this is a State account by looking at the discriminator
            if account.data.len() >= 8 && account.data[0..8] == State::DISCRIMINATOR {
                info!("Found State account: {}", pubkey_str);

                // Print the discriminator bytes
                let discriminator = &account.data[0..8];
                info!("State account discriminator: {:?}", discriminator);

                // Get the owner program ID (original program ID)
                let original_program_id = account.owner.to_string();

                // Get the new program ID directly from the program configs
                let new_program_id = match self.config.program_configs.get(&original_program_id) {
                    Some(config) => match &config.new_program_id {
                        Some(id) => id,
                        None => {
                            info!(
                                "No new program ID configured for {}, skipping",
                                original_program_id
                            );
                            continue;
                        }
                    },
                    None => {
                        info!(
                            "No program config found for {}, skipping",
                            original_program_id
                        );
                        continue;
                    }
                };

                // Try to deserialize the State account
                match State::try_deserialize(&mut &account.data[..]) {
                    Ok(mut state) => {
                        // Print the original values
                        info!(
                            "Original State account whitelist mint: {}",
                            state.whitelist_mint
                        );
                        info!("Original State account admin pubkey: {}", state.admin);
                        info!("Original State account signer: {}", state.signer);
                        info!(
                            "Original State account discount mint: {}",
                            state.discount_mint
                        );

                        // Update the admin and signer fields
                        let drift_signer =
                            Pubkey::from_str(&self.generate_new_drift_signer_pda(new_program_id)?)?;
                        state.admin = new_authority;
                        state.signer = drift_signer;

                        info!(
                            "Updated admin and signer to: {} and {}",
                            new_authority, drift_signer
                        );

                        // Generate new State PDA address with the new program ID
                        let new_address = self.generate_new_state_pda(new_program_id)?;
                        info!("Remapping State PDA from {} to {}", pubkey_str, new_address);

                        // Create a new account with the updated data
                        let mut new_account = account.clone();

                        // Serialize the updated State
                        let mut buffer = Vec::new();
                        state.try_serialize(&mut buffer)?;

                        new_account.data = buffer;
                        new_account.owner = Pubkey::from_str(new_program_id)?;

                        // Save the updated account
                        let new_pubkey = Pubkey::from_str(&new_address)?;
                        self.save_account_to_file(&new_pubkey, &new_account)?;
                        info!("Updated and saved State account: {}", new_address);
                    }
                    Err(err) => {
                        info!(
                            "Failed to deserialize State account {}: {}",
                            pubkey_str, err
                        );
                    }
                }
            }
        }

        Ok(())
    }

    /// Generate a new State PDA address
    fn generate_new_state_pda(&self, new_program_id: &str) -> Result<String> {
        let new_program_pubkey = Pubkey::from_str(new_program_id)?;

        // State PDA is typically derived with a simple seed like "state"
        let seeds = &["drift_state".as_bytes()];

        let (new_address, _) = Pubkey::find_program_address(seeds, &new_program_pubkey);

        Ok(new_address.to_string())
    }

    /// Generate a new State PDA address
    fn generate_new_drift_signer_pda(&self, new_program_id: &str) -> Result<String> {
        let new_program_pubkey = Pubkey::from_str(new_program_id)?;

        // State PDA is typically derived with a simple seed like "state"
        let seeds = &["drift_signer".as_bytes()];

        let (new_address, _) = Pubkey::find_program_address(seeds, &new_program_pubkey);

        Ok(new_address.to_string())
    }
}
