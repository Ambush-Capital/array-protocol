use super::Size;
use anchor_lang::prelude::*;

#[account]
#[repr(C)]
pub struct UserTokenVault {
    /// SPL token mint (e.g. USDC) for deposits
    pub mint: Pubkey,

    /// User total deposits (128-bit for large amounts)
    pub deposited_amount: u128,

    pub token_vault_index: u16,

    pub _reserved: [u8; 30],
}

impl Size for UserTokenVault {
    const SIZE: usize = 88;
}
