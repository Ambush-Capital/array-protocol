use super::AccountProcessor;
use crate::drift_idl::accounts::SpotMarket;
use crate::pda::PdaGenerator;
use crate::pda::PdaType;
use anchor_lang::{AccountDeserialize, AccountSerialize, Discriminator};
use anyhow::{Context, Result};
use log::info;
use solana_sdk::account::Account;
use solana_sdk::pubkey::Pubkey;

pub struct SpotMarketProcessor {
    new_generator: PdaGenerator,
    new_program_id: Pubkey,
}

impl SpotMarketProcessor {
    pub fn new(new_program_id: &Pubkey) -> Self {
        Self {
            new_generator: PdaGenerator::new(new_program_id),
            new_program_id: *new_program_id,
        }
    }

    fn deserialize_spot_market(&self, account: &Account) -> Result<SpotMarket> {
        SpotMarket::try_deserialize(&mut &account.data[..])
            .context("Failed to deserialize SpotMarket account")
    }
}

impl AccountProcessor for SpotMarketProcessor {
    fn process_account(&self, pubkey: &Pubkey, account: &Account) -> Result<(Pubkey, Account)> {
        let mut spot_market = self.deserialize_spot_market(account)?;
        let market_index = spot_market.market_index;

        info!(
            "Extracted market index {} from SpotMarket PDA",
            market_index
        );

        let new_vault_pda = self
            .new_generator
            .find_pda(PdaType::SpotMarketVault { market_index });
        let new_pda = self
            .new_generator
            .find_pda(PdaType::SpotMarket { market_index });

        info!(
            "Swapping PDAs on SpotMarket account\n\
            \tVault: {} -> {}\n\
            \tMarket: {} -> {}",
            spot_market.vault, new_vault_pda.address, pubkey, new_pda.address
        );

        spot_market.vault = new_vault_pda.address;
        spot_market.pubkey = new_pda.address;

        // Serialize the updated SpotMarket
        let mut buffer = Vec::new();
        spot_market
            .try_serialize(&mut buffer)
            .context("Failed to serialize SpotMarket account")?;

        // Create a new account with the updated data
        let mut new_account = account.clone();
        new_account.data = buffer;

        // Set the new program ID as the owner
        new_account.owner = self.new_program_id;

        // Return both the new PDA and the account
        Ok((new_pda.address, new_account))
    }

    fn can_process(&self, account: &Account) -> bool {
        account.data.len() >= 8 && account.data[0..8] == SpotMarket::DISCRIMINATOR
    }
}
