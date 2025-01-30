use crate::controller::update_user_position;
use crate::state::{TokenVault, User};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};

#[derive(Accounts)]
#[instruction(vault_index: u16)]
pub struct WithdrawSpl<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
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

pub fn handle_withdraw_spl(ctx: Context<WithdrawSpl>, vault_index: u16, amount: u64) -> Result<()> {
    // let token_vault = ctx.accounts.token_vault.load()?;

    // Signer seeds for the vault PDA
    let seeds = &[
        b"vault".as_ref(),
        &vault_index.to_le_bytes(),
        &[ctx.bumps.token_vault],
    ];
    let signer = &[&seeds[..]];

    // 1) Transfer from vault -> user
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.user_vault_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.token_vault.to_account_info(),
        },
        signer,
    );
    anchor_spl::token::transfer(cpi_ctx, amount)?;

    // 2) Subtract from vault global balance
    let mut vault_state = ctx.accounts.token_vault.load_mut()?;
    vault_state.balance = vault_state
        .balance
        .checked_sub(amount as u128)
        .ok_or(crate::controller::errors::VaultError::Underflow)?;

    // 3) Update user position
    let user_state = &mut ctx.accounts.user_state;
    update_user_position(user_state, vault_index, -(amount as i64))?;

    Ok(())
}
