use anyhow::Result;
use solana_sdk::account::Account;
use solana_sdk::pubkey::Pubkey;

/// Trait for processing Solana accounts
pub trait AccountProcessor {
    /// Process an account and return the modified version along with its new address
    fn process_account(&self, pubkey: &Pubkey, account: &Account) -> Result<(Pubkey, Account)>;

    /// Check if this processor can handle the given account
    fn can_process(&self, account: &Account) -> bool;
}

mod spot_market;
mod state;
mod token;

pub use spot_market::SpotMarketProcessor;
pub use state::StateProcessor;
pub use token::TokenProcessor;
