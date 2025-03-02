//! Core PDA derivation utilities
use solana_program::pubkey::Pubkey;

/// Find a program address with error handling
pub fn find_program_address(seeds: &[&[u8]], program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(seeds, program_id)
}
