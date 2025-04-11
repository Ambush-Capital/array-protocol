use crate::ids::admin_hot_wallet;
use crate::state::{ProgramState, Size, SupportedTokenVault};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};

/// Accounts for `init_token_vault`.
#[derive(Accounts)]
pub struct InitTokenVault<'info> {
    #[account(
        mut,
        constraint = admin.key() == admin_hot_wallet::id()
    )]
    pub admin: Signer<'info>,

    #[account(mut)]
    pub state: Account<'info, ProgramState>,

    // #[account(owner = token_program.key())]
    #[account()]
    pub token_vault_mint: Box<InterfaceAccount<'info, Mint>>,

    /// TokenVault metadata
    #[account(
        init,
        payer = admin,
        space = SupportedTokenVault::SIZE,
        seeds = [b"token_vault".as_ref(), state.token_vault_count.to_le_bytes().as_ref()],
        bump
    )]
    pub token_vault: Account<'info, SupportedTokenVault>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
}

/// Handler for `init_token_vault`.
pub fn handle_init_token_vault(ctx: Context<InitTokenVault>) -> Result<()> {
    msg!("Init Token Vault");
    msg!("Admin: {}", ctx.accounts.admin.key());
    msg!("Program State: {}", ctx.accounts.state.key());
    msg!("Token Vault Mint: {}", ctx.accounts.token_vault_mint.key());
    msg!("Token Vault: {}", ctx.accounts.token_vault.key());
    msg!("Rent: {}", ctx.accounts.rent.key());
    msg!("System Program: {}", ctx.accounts.system_program.key());
    msg!("Token Program: {}", ctx.accounts.token_program.key());

    let token_vault_count = ctx.accounts.state.token_vault_count;

    let vault_state = &mut ctx.accounts.token_vault;
    vault_state.mint = ctx.accounts.token_vault_mint.key();
    vault_state.balance = 0;
    vault_state.token_vault_index = token_vault_count;

    let state = &mut ctx.accounts.state;
    state.token_vault_count += 1;

    Ok(())
}
