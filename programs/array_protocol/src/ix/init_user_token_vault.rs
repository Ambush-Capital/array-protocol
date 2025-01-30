use crate::state::{TokenVault, User};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

/// Accounts for `init_token_vault`.
#[derive(Accounts)]
#[instruction(vault_index: u16)]
pub struct InitUserTokenVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// TokenVault metadata
    #[account(
        init,
        payer = authority,
        // 8 + 32 + 32 + 32 + 32 + 16 = 152 => plus buffer = 160
        space = 160,
        seeds = [b"vault".as_ref(), &vault_index.to_le_bytes()],
        bump
    )]
    pub token_vault: AccountLoader<'info, TokenVault>,

    #[account(owner = token_program.key())]
    pub token_vault_mint: Account<'info, Mint>,

    #[account(
        init,
        seeds = [b"user_vault_account".as_ref(), authority.key().as_ref(), &vault_index.to_le_bytes()],
        bump,
        payer = authority,
        token::mint = token_vault_mint,
        token::authority = token_vault
    )]
    pub token_vault_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_state: Account<'info, User>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

/// Handler for `init_user_token_vault`.
pub fn handle_init_user_token_vault(
    ctx: Context<InitUserTokenVault>,
    vault_index: u16,
) -> Result<()> {
    let mut vault_state = ctx.accounts.token_vault.load_init()?;
    vault_state.vault = ctx.accounts.token_vault_account.key();
    vault_state.mint = ctx.accounts.token_vault_mint.key();
    vault_state.balance = 0;

    let user_state = &mut ctx.accounts.user_state;

    // Check if user already has this vault in positions, if not, store it
    let mut found_slot = false;
    for pos in user_state.positions.iter_mut() {
        if pos.vault_index == vault_index {
            // Vault already exists for user, do nothing
            found_slot = true;
            break;
        }
    }

    if !found_slot {
        // Find an empty slot in user.positions and add the new vault entry
        for pos in user_state.positions.iter_mut() {
            if pos.user_vault == Pubkey::default() {
                pos.vault_index = vault_index;
                pos.user_vault = ctx.accounts.token_vault_account.key();
                pos.balance = 0; // Start with zero balance
                break;
            }
        }
    }

    Ok(())
}
