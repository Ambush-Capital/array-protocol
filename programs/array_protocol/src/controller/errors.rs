use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    #[msg("Overflow occurred")]
    Overflow,

    #[msg("Underflow occurred")]
    Underflow,

    #[msg("No free position slot found!")]
    NoPositionSlot,

    #[msg("Invalid vault index for this position")]
    InvalidVaultIndex,

    #[msg("Unauthorized user")]
    UnauthorizedUser,
}
