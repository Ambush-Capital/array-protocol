use super::AccountProcessor;
use crate::drift_idl::accounts::State;
use crate::pda::PdaGenerator;
use crate::pda::PdaType;
use anchor_lang::{AccountDeserialize, AccountSerialize, Discriminator};
use anyhow::{Context, Result};
use log::info;
use solana_sdk::account::Account;
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;

pub struct StateProcessor {
    new_generator: PdaGenerator,
    new_program_id: Pubkey,
}

impl StateProcessor {
    pub fn new(new_program_id: &Pubkey) -> Self {
        Self {
            new_generator: PdaGenerator::new(new_program_id),
            new_program_id: *new_program_id,
        }
    }

    fn deserialize_state(&self, account: &Account) -> Result<State> {
        State::try_deserialize(&mut &account.data[..])
            .context("Failed to deserialize State account")
    }
}

impl AccountProcessor for StateProcessor {
    fn process_account(&self, pubkey: &Pubkey, account: &Account) -> Result<(Pubkey, Account)> {
        let mut state = self.deserialize_state(account)?;

        // The new admin/signer pubkey
        let new_authority = Pubkey::from_str("Gxus3woPgbAPYiqasvr6eoaKAFrpK3vpmJG7kBfU9gCn")
            .context("Invalid authority pubkey")?;

        let drift_signer_pda = self.new_generator.find_pda(PdaType::DriftSigner);
        let new_state_pda = self.new_generator.find_pda(PdaType::State);

        info!(
            "Swapping PDAs on State account\n\
            \tAdmin: {} -> {}\n\
            \tSigner: {} -> {}\n\
            \tState: {} -> {}",
            state.admin,
            new_authority,
            state.signer,
            drift_signer_pda.address,
            pubkey,
            new_state_pda.address
        );

        state.admin = new_authority;
        state.signer = drift_signer_pda.address;

        // Serialize the updated State
        let mut buffer = Vec::new();
        state
            .try_serialize(&mut buffer)
            .context("Failed to serialize State account")?;

        // Create a new account with the updated data AND owner
        let mut new_account = account.clone();
        new_account.data = buffer;

        // Set the new program ID as the owner
        new_account.owner = self.new_program_id;

        // Return both the new PDA and the account
        Ok((new_state_pda.address, new_account))
    }

    fn can_process(&self, account: &Account) -> bool {
        account.data.len() >= 8 && account.data[0..8] == State::DISCRIMINATOR
    }
}
