use anchor_lang::prelude::*;

use super::Size;

#[account()]
#[repr(C)]
pub struct ProgramState {
    pub admin: Pubkey,
    pub signer_pda: Pubkey,
    pub token_vault_count: u16,
    pub bump: u8,
    pub _padding: [u8; 5],
    pub reserved: [u8; 64],
}

impl Size for ProgramState {
    const SIZE: usize = 144;
}
