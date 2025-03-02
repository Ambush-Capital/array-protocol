use super::AccountProcessor;
use anyhow::{Context, Result};
use log::info;
use solana_sdk::account::Account;
use solana_sdk::program_pack::Pack;
use solana_sdk::pubkey::Pubkey;
use spl_token::state::Account as TokenAccount;

#[derive(Debug, Clone, Copy)]
pub struct TokenProcessor {
    // Store the drift signer PDA to use for owner updates
    drift_signer: Option<Pubkey>,
    // We're processing vault token accounts - we need to know the destination Pubkey
    target_vault_pubkey: Option<Pubkey>,
}

impl TokenProcessor {
    // Add a new constructor that takes a drift signer
    pub fn new_with_signer(drift_signer: Pubkey) -> Self {
        Self {
            drift_signer: Some(drift_signer),
            target_vault_pubkey: None,
        }
    }

    // Add a method to set the target vault pubkey
    pub fn with_target_vault(mut self, target_vault: Pubkey) -> Self {
        self.target_vault_pubkey = Some(target_vault);
        self
    }

    fn deserialize_token_account(&self, account: &Account) -> Result<TokenAccount> {
        TokenAccount::unpack(&account.data).context("Failed to deserialize token account")
    }

    // Method to update token account owner
    fn update_token_owner(&self, account: &Account, new_owner: &Pubkey) -> Result<Account> {
        let mut modified_account = account.clone();

        // Deserialize token account
        let mut token = self.deserialize_token_account(account)?;

        info!(
            "Changing token account authority from {} to {}",
            token.owner, new_owner
        );

        // Update owner
        token.owner = *new_owner;

        // Reserialize
        let mut new_data = vec![0; TokenAccount::get_packed_len()];
        TokenAccount::pack(token, &mut new_data)?;
        modified_account.data = new_data;

        Ok(modified_account)
    }
}

impl AccountProcessor for TokenProcessor {
    fn process_account(&self, pubkey: &Pubkey, account: &Account) -> Result<(Pubkey, Account)> {
        // Deserialize to validate and get current information
        let token = self.deserialize_token_account(account)?;

        info!("Token account {} has owner {}", pubkey, token.owner);

        // If we have a drift signer, update the owner
        if let Some(signer) = self.drift_signer {
            let modified_account = self.update_token_owner(account, &signer)?;
            let target_pubkey = self.target_vault_pubkey.unwrap_or(*pubkey);
            Ok((target_pubkey, modified_account))
        } else {
            // If no drift signer is set, just return the original account with its current Pubkey
            Ok((*pubkey, account.clone()))
        }
    }

    fn can_process(&self, account: &Account) -> bool {
        // Check if this is a token account by owner
        account.owner == spl_token::id() &&
        // Token accounts have a specific length
        account.data.len() == TokenAccount::get_packed_len()
    }
}
