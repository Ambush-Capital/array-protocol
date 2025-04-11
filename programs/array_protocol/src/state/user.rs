use anchor_lang::prelude::*;

use super::Size;

/// Main user account, storing authority, delegate, and up to 8 positions.
#[account]
#[repr(C)]
pub struct User {
    pub authority: Pubkey,
    pub delegate: Pubkey,
    pub bump: u8,
    pub _padding: [u8; 7], // Added padding to align to 8-byte boundary
    pub positions: [Position; 8],
}

impl Size for User {
    const SIZE: usize = 8 + 32 + 32 + 1 + 7 + 8 * Position::SIZE;
}

/// A position referencing a vault_index and current token balance.
#[derive(AnchorSerialize, AnchorDeserialize, Copy, Clone, Debug)]
#[repr(C)]
pub struct Position {
    pub user_token_vault: Pubkey,
    pub user_token_vault_account: Pubkey,
    pub protocol: Pubkey,
    pub protocol_vault: Pubkey,
    pub deposited_amount: u64,
    pub vault_index: u16,
    pub _padding: [u8; 6],
}

impl Default for Position {
    fn default() -> Self {
        Self {
            user_token_vault: Pubkey::default(),
            user_token_vault_account: Pubkey::default(),
            protocol: Pubkey::default(),
            protocol_vault: Pubkey::default(),
            deposited_amount: 0,
            vault_index: 0,
            _padding: [0; 6],
        }
    }
}

impl Size for Position {
    const SIZE: usize = 32 + 32 + 32 + 32 + 8 + 2 + 6;
}
