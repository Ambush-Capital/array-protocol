use crate::controller::update_user_position;
use crate::state::{TokenVault, User};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};

/// Accounts for `deposit_spl`.
#[derive(Accounts)]
#[instruction(vault_index: u16)]
pub struct DepositSpl<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    // Make sure the user_state is the correct PDA for user:
    #[account(
        mut,
        // seeds = [b"user", user.key().as_ref()],
        // bump = user_state.bump,
        // has_one = authority @ VaultError::UnauthorizedUser
    )]
    pub user_state: Account<'info, User>,

    #[account(
        mut,
        seeds = [b"vault".as_ref(), vault_index.to_le_bytes().as_ref()],
        bump,
    )]
    pub token_vault: AccountLoader<'info, TokenVault>,

    #[account(owner = token_program.key())]
    pub token_vault_mint: Account<'info, Mint>,

    #[account(
        mut,    
        seeds = [b"user_vault_account".as_ref(), authority.key().as_ref(), &vault_index.to_le_bytes()],
        bump,
        token::mint = token_vault_mint, // Ensures it's the correct mint
        token::authority = token_vault // Ensures it belongs to the vault
    )]
    pub user_vault_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// Handler function for `deposit_spl`.
pub fn handle_deposit_spl(ctx: Context<DepositSpl>, _vault_index: u16, amount: u64) -> Result<()> {
    let user = &ctx.accounts.authority;
    let token_program = &ctx.accounts.token_program;

    // 1) Transfer from user -> vault
    let cpi_ctx = CpiContext::new(
        token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.user_vault_account.to_account_info(),
            authority: user.to_account_info(),
        },
    );
    anchor_spl::token::transfer(cpi_ctx, amount)?;

    // 2) Update vault global balance
    let mut vault_state = ctx.accounts.token_vault.load_mut()?;
    vault_state.balance = vault_state
        .balance
        .checked_add(amount as u128)
        .ok_or(crate::controller::errors::VaultError::Overflow)?;

    // 3) Update user position
    let user_state = &mut ctx.accounts.user_state;
    update_user_position(user_state, _vault_index, amount as i64)?;

    Ok(())
}
