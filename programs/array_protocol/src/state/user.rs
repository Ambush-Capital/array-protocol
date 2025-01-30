use anchor_lang::prelude::*;

/// Main user account, storing authority, delegate, and up to 8 positions.
#[account]
pub struct User {
    pub bump: u8,
    pub authority: Pubkey,
    pub delegate: Pubkey,
    pub positions: [Position; 8],
}

/// A position referencing a vault_index and current token balance.
#[derive(AnchorSerialize, AnchorDeserialize, Copy, Clone, Debug, Default)]
pub struct Position {
    pub balance: u64,
    pub vault_index: u16,
    pub user_vault: Pubkey,
}
