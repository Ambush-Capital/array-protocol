use anchor_lang::prelude::*;

use super::Size;

/// Global vault metadata stored on-chain.
#[account]
#[repr(C)]
pub struct SupportedTokenVault {
    /// SPL token mint (e.g. USDC) for deposits
    pub mint: Pubkey,

    /// Global total deposits (128-bit for large amounts)
    pub balance: u128,

    pub token_vault_index: u16,

    pub _reserved: [u8; 30],
}

impl Size for SupportedTokenVault {
    const SIZE: usize = 88;
}
