use crate::state::{ProgramState, Size, SupportedTokenVault, User, UserTokenVault};
use anchor_lang::prelude::*;
use anchor_spl::token::Token;
use anchor_spl::token_interface::{Mint, TokenAccount};

/// Accounts for `init_token_vault`.
#[derive(Accounts)]
#[instruction(vault_index: u16)]
pub struct InitUserTokenVault<'info> {
    // user's signer account
    #[account(mut)]
    pub signer: Signer<'info>,

    /// TokenVault metadata
    #[account(
        seeds = [b"token_vault".as_ref(), vault_index.to_le_bytes().as_ref()],
        bump
    )]
    pub token_vault: Box<Account<'info, SupportedTokenVault>>,

    #[account(
        init,
        seeds = [b"user_vault".as_ref(), user_state.key().as_ref(), vault_index.to_le_bytes().as_ref()],
        bump,
        payer = signer,
        space = UserTokenVault::SIZE,
    )]
    pub user_token_vault: Box<Account<'info, UserTokenVault>>,

    #[account(
        init,
        payer = signer,
        token::mint = token_vault_mint,
        token::authority = user_state,
        token::token_program = token_program,
        seeds = [b"user_vault_account".as_ref(), user_state.key().as_ref(), vault_index.to_le_bytes().as_ref()],
        bump,
    )]
    pub user_token_vault_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: i am just testing
    #[account(mut)]
    pub user_state: Box<Account<'info, User>>,

    #[account(mut)]
    pub state: Box<Account<'info, ProgramState>>,

    #[account(owner = token_program.key())]
    pub token_vault_mint: InterfaceAccount<'info, Mint>,

    /// CHECK: program signer
    pub array_signer: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

/// Handler for `init_user_token_vault`.
/// Initializes a new user UserTokenVault and TokenAccount for that vault for the user.
pub fn handle_init_user_token_vault(
    ctx: Context<InitUserTokenVault>,
    vault_index: u16,
) -> Result<()> {
    msg!(
        "Initializing user token vault for vault index: {}",
        vault_index
    );

    let user_token_vault = &mut ctx.accounts.user_token_vault;
    user_token_vault.mint = ctx.accounts.token_vault.mint;
    user_token_vault.deposited_amount = 0;
    user_token_vault.token_vault_index = vault_index;

    Ok(())
}
