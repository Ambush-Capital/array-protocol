use crate::ix::*;
use anchor_lang::prelude::*;

declare_id!("5jNZph2CQjoQcaru3fjkDvXDmMGpnrNAG8CmTyaTdnm9");

declare_program!(drift);


//Eo5ZcKDj3G3TxD2QWWaXA8Chg1DTtdZerXprq3tTFnPf
pub const ROBOT_PUBKEY: Pubkey = Pubkey::new_from_array([
    204, 245, 206, 71, 164, 68, 53, 124, 213, 223, 21, 178, 140, 128, 126, 140, 177, 13, 107, 67,
    35, 30, 180, 255, 214, 243, 112, 12, 185, 136, 112, 166,
]);

#[program]
pub mod array_protocol {
    use super::*;

    pub fn create_user(ctx: Context<CreateUser>) -> Result<()> {
        handle_create_user(ctx)
    }

    /// Initializes a TokenVault + SPL token account.
    pub fn init_user_token_vault(ctx: Context<InitUserTokenVault>, vault_index: u16) -> Result<()> {
        handle_init_user_token_vault(ctx, vault_index)
    }

    /// Deposits SPL tokens into the vault, updating the user’s position for `vault_index`.
    pub fn deposit_spl(ctx: Context<DepositSpl>, vault_index: u16, amount: u64) -> Result<()> {
        handle_deposit_spl(ctx, vault_index, amount)
    }

    /// Withdraws SPL tokens from the vault, updating the user’s position for `vault_index`.
    pub fn withdraw_spl(ctx: Context<WithdrawSpl>, vault_index: u16, amount: u64) -> Result<()> {
        handle_withdraw_spl(ctx, vault_index, amount)
    }
}

pub mod controller;
pub mod ix;
pub mod state;
