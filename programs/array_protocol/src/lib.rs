use crate::ix::*;
use anchor_lang::prelude::*;

declare_id!("5jNZph2CQjoQcaru3fjkDvXDmMGpnrNAG8CmTyaTdnm9");

declare_program!(drift);
declare_program!(klend);

//Eo5ZcKDj3G3TxD2QWWaXA8Chg1DTtdZerXprq3tTFnPf
pub const ROBOT_PUBKEY: Pubkey = Pubkey::new_from_array([
    204, 245, 206, 71, 164, 68, 53, 124, 213, 223, 21, 178, 140, 128, 126, 140, 177, 13, 107, 67,
    35, 30, 180, 255, 214, 243, 112, 12, 185, 136, 112, 166,
]);

#[program]
pub mod array_protocol {
    use super::*;

    pub fn init_program_state(ctx: Context<Initialize>) -> Result<()> {
        handle_init_program_state(ctx)
    }

    pub fn init_user(ctx: Context<InitUser>) -> Result<()> {
        handle_init_user(ctx)
    }

    pub fn init_supported_token_vault(ctx: Context<InitTokenVault>) -> Result<()> {
        handle_init_token_vault(ctx)
    }

    /// Initializes a TokenVault + SPL token account.
    pub fn init_user_token_vault(ctx: Context<InitUserTokenVault>, vault_index: u16) -> Result<()> {
        handle_init_user_token_vault(ctx, vault_index)
    }

    /// Deposits SPL tokens into the vault, updating the user's position for `vault_index`.
    pub fn deposit_spl(ctx: Context<DepositSpl>, vault_index: u16, amount: u64) -> Result<()> {
        handle_deposit_spl(ctx, vault_index, amount)
    }

    /// Withdraws SPL tokens from the vault, updating the user's position for `vault_index`.
    pub fn withdraw_spl(ctx: Context<WithdrawSpl>, vault_index: u16, amount: u64) -> Result<()> {
        handle_withdraw_spl(ctx, vault_index, amount)
    }

    pub fn init_drift_user(ctx: Context<InitDriftUser>, sub_account_id: u16) -> Result<()> {
        handle_init_drift_user(ctx, sub_account_id)
    }

    pub fn init_drift_user_stats(ctx: Context<InitDriftUserStats>) -> Result<()> {
        handle_init_drift_user_stats(ctx)
    }

    pub fn drift_deposit<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, DriftDeposit<'info>>,
        vault_index: u16,
        market_index: u16,
        amount: u64,
    ) -> Result<()> {
        handle_drift_deposit(ctx, vault_index, market_index, amount)
    }

    pub fn drift_withdraw<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, DriftWithdraw<'info>>,
        vault_index: u16,
        market_index: u16,
        amount: u64,
    ) -> Result<()> {
        handle_drift_withdraw(ctx, vault_index, market_index, amount)
    }
}

pub mod controller;
pub mod ids;
pub mod ix;
pub mod state;

#[macro_export]
macro_rules! validate {
        ($assert:expr, $err:expr) => {{
            if ($assert) {
                Ok(())
            } else {
                let error_code: ErrorCode = $err;
                msg!("Error {} thrown at {}:{}", error_code, file!(), line!());
                Err(error_code)
            }
        }};
        ($assert:expr, $err:expr, $($arg:tt)+) => {{
        if ($assert) {
            Ok(())
        } else {
            let error_code: ErrorCode = $err;
            msg!("Error {} thrown at {}:{}", error_code, file!(), line!());
            msg!($($arg)*);
            Err(error_code)
        }
    }};
}

pub fn get_signer_seeds(nonce: &u8) -> [&[u8]; 2] {
    [b"array_signer".as_ref(), bytemuck::bytes_of(nonce)]
}

pub fn get_user_seeds<'a>(signer: &'a Pubkey, nonce: &'a u8) -> [&'a [u8]; 3] {
    [b"user".as_ref(), signer.as_ref(), bytemuck::bytes_of(nonce)]
}
