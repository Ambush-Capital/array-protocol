use anchor_lang::prelude::*;

pub mod errors;
pub use errors::*;

///
/// Shared helpers or "controllers" for business logic.
///
pub fn update_user_position(
    user: &mut Account<crate::state::User>,
    user_token_vault: &mut Account<crate::state::UserTokenVault>,
    user_token_vault_key: Pubkey,
    user_token_vault_account: Pubkey,
    protocol: Pubkey,
    protocol_vault: Pubkey,
    vault_index: u16,
    delta: u64,
    withdraw: bool,
) -> Result<()> {
    // Try to find an existing position
    let mut found_slot = None;

    for (i, pos) in user.positions.iter().enumerate() {
        if pos.vault_index == vault_index && pos.protocol_vault == protocol_vault {
            found_slot = Some(i);
            break;
        }
    }

    // If no slot found and we are creating a new position, find empty slot
    if found_slot.is_none() {
        for (i, pos) in user.positions.iter().enumerate() {
            if pos.user_token_vault == Pubkey::default() {
                found_slot = Some(i);
                break;
            }
        }
    }

    require!(found_slot.is_some(), VaultError::NoPositionSlot);
    let idx = found_slot.unwrap();
    let pos = &mut user.positions[idx];

    // If this slot was empty, set the vault_index
    if pos.user_token_vault == Pubkey::default() && pos.deposited_amount == 0 {
        pos.vault_index = vault_index;
        pos.user_token_vault = user_token_vault_key;
        pos.user_token_vault_account = user_token_vault_account;
        pos.protocol = protocol;
        pos.protocol_vault = protocol_vault;
    }
    require_eq!(pos.vault_index, vault_index, VaultError::InvalidVaultIndex);

    // Update the balance
    let new_balance = if withdraw {
        pos.deposited_amount
            .checked_sub(delta)
            .ok_or(VaultError::Underflow)?
    } else {
        pos.deposited_amount
            .checked_add(delta)
            .ok_or(VaultError::Overflow)?
    };

    require_gte!(new_balance, 0, VaultError::Underflow);
    pos.deposited_amount = new_balance;

    // Update the user_token_vault balance
    let new_vault_balance = if withdraw {
        user_token_vault
            .deposited_amount
            .checked_sub(delta as u128)
            .ok_or(VaultError::Underflow)?
    } else {
        user_token_vault
            .deposited_amount
            .checked_add(delta as u128)
            .ok_or(VaultError::Overflow)?
    };

    require_gte!(new_vault_balance, 0, VaultError::Underflow);
    user_token_vault.deposited_amount = new_vault_balance;

    Ok(())
}
