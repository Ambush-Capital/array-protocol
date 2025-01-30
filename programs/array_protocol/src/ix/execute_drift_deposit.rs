use crate::state::{TokenVault, User};
use crate::{drift, ROBOT_PUBKEY};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use drift::accounts::{State, User as DriftUser, UserStats};
use drift::program::Drift;

#[derive(Accounts)]
#[instruction(vault_index: u16, market_index: u16)] 
pub struct ExecuteDriftDeposit<'info> {
    #[account(
        signer,
        constraint = authority.key() == ROBOT_PUBKEY // Only the robot can call this
    )]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub user_state: Account<'info, User>,

    #[account(
        mut,
        seeds = [b"vault", &vault_index.to_le_bytes()],
        bump
    )]
    pub token_vault: AccountLoader<'info, TokenVault>,

    #[account(
        mut,
        seeds = [b"user_vault_account".as_ref(), user_state.authority.as_ref(), &vault_index.to_le_bytes()],
        bump,
        token::mint = token_vault_mint, 
        token::authority = token_vault 
    )]
    pub user_vault_account: Account<'info, TokenAccount>,

    pub token_vault_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,

    /// Drift Program State
    pub state: Box<Account<'info, State>>,

    /// Drift User Account
    #[account(mut)]
    pub drift_user: Box<Account<'info, DriftUser>>,

    /// Drift User Stats Account
    #[account(
        mut,
        // constraint = is_stats_for_user(&drift_user, &drift_user_stats)?
    )]
    pub drift_user_stats: Box<Account<'info, UserStats>>,

    /// Drift Spot Market Vault
    #[account(
        mut,
        seeds = [b"spot_market_vault".as_ref(), market_index.to_le_bytes().as_ref()],
        bump,
    )]
    pub spot_market_vault: Box<Account<'info, TokenAccount>>,

    /// Drift Program
    pub drift_program: Program<'info, Drift>,
}

pub fn handle_drift_deposit(
    ctx: Context<ExecuteDriftDeposit>,
    vault_index: u16,
    market_index: u16,
    amount: u64,
) -> Result<()> {
    let drift_program = &ctx.accounts.drift_program;
    
    // Drift Deposit CPI Call
    let cpi_ctx = CpiContext::new(
        drift_program.to_account_info(),
        drift::cpi::accounts::Deposit {
            state: ctx.accounts.state.to_account_info(),
            user: ctx.accounts.drift_user.to_account_info(),
            user_stats: ctx.accounts.drift_user_stats.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
            spot_market_vault: ctx.accounts.spot_market_vault.to_account_info(),
            user_token_account: ctx.accounts.user_vault_account.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
        },
    );
    
    drift::cpi::deposit(cpi_ctx, market_index, amount, false)?;

    Ok(())
}