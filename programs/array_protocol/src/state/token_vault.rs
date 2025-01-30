use anchor_lang::prelude::*;

/// Global vault metadata stored on-chain.
#[account(zero_copy)]
#[repr(C)]
pub struct TokenVault {
    /// SPL token mint (e.g. USDC) for deposits
    pub mint: Pubkey,

    /// The actual SPL token account that holds the funds
    pub vault: Pubkey,

    /// Global total deposits (128-bit for large amounts)
    pub balance: u128,

    pub _reserved: [u8; 16],
}
