use anchor_lang::prelude::*;

pub mod errors;
pub use errors::*;

///
/// Shared helpers or “controllers” for business logic.
///
pub fn update_user_position(
    user: &mut Account<crate::state::User>,
    vault_index: u16,
    delta: i64,
) -> Result<()> {
    // Try to find an existing position
    let mut found_slot = None;

    for (i, pos) in user.positions.iter().enumerate() {
        if pos.vault_index == vault_index {
            found_slot = Some(i);
            break;
        }
    }

    // If no slot found and we are depositing, find empty slot
    if found_slot.is_none() && delta > 0 {
        for (i, pos) in user.positions.iter().enumerate() {
            if pos.vault_index == 0 && pos.balance == 0 {
                found_slot = Some(i);
                break;
            }
        }
    }

    let idx = found_slot.ok_or(VaultError::NoPositionSlot)?;
    let pos = &mut user.positions[idx];

    // If this slot was empty, set the vault_index
    if pos.vault_index == 0 && pos.balance == 0 {
        pos.vault_index = vault_index;
    }
    require_eq!(pos.vault_index, vault_index, VaultError::InvalidVaultIndex);

    // Update the balance
    let new_balance = (pos.balance as i128)
        .checked_add(delta as i128)
        .ok_or(VaultError::Overflow)?;

    require_gte!(new_balance, 0, VaultError::Underflow);
    pos.balance = new_balance as u64;

    Ok(())
}
