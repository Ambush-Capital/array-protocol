use crate::controller::update_user_position;
use crate::state::{SupportedTokenVault, User, UserTokenVault};
use crate::{drift, get_user_seeds};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use drift::program::Drift;

#[derive(Accounts)]
#[instruction(vault_index: u16)]
pub struct DriftWithdraw<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(owner = token_program.key())]
    pub token_vault_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub user_state: Account<'info, User>,

    #[account(
        mut,
        seeds = [b"token_vault", &vault_index.to_le_bytes()],
        bump
    )]
    pub token_vault: Box<Account<'info, SupportedTokenVault>>,

    #[account(
        mut,
        seeds = [b"user_vault_account".as_ref(), user_state.key().as_ref(), vault_index.to_le_bytes().as_ref()],
        bump,
        token::mint = token_vault_mint,
        token::authority = user_state,
        token::token_program = token_program
    )]
    pub user_vault_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"user_vault".as_ref(), user_state.key().as_ref(), vault_index.to_le_bytes().as_ref()],
        bump,
    )]
    pub user_token_vault: Account<'info, UserTokenVault>,

    /// CHECK: target program handles
    #[account(mut)]
    pub drift_state: AccountInfo<'info>,

    /// CHECK: target program handles
    #[account(mut)]
    pub drift_user: AccountInfo<'info>,

    /// CHECK: target program handles
    #[account(mut)]
    pub drift_user_stats: AccountInfo<'info>,

    /// CHECK: target program handles
    #[account(mut)]
    pub spot_market_vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: forced drift_signer
    pub drift_signer: AccountInfo<'info>,

    /// CHECK: program signer
    pub array_signer: AccountInfo<'info>,

    /// Drift Program
    pub drift_program: Program<'info, Drift>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_drift_withdraw<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, DriftWithdraw<'info>>,
    vault_index: u16,
    market_index: u16,
    amount: u64,
) -> Result<()> {
    let drift_program = ctx.accounts.drift_program.to_account_info();

    let seeds = get_user_seeds(
        &ctx.accounts.user_state.authority,
        &ctx.accounts.user_state.bump,
    );
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = drift::cpi::accounts::Withdraw {
        state: ctx.accounts.drift_state.to_account_info(),
        user: ctx.accounts.drift_user.to_account_info(), // TODO: this is a pda, we need to create this account if it doens't exist here.
        user_stats: ctx.accounts.drift_user_stats.to_account_info(), // TODO: this is a pda
        authority: ctx.accounts.user_state.to_account_info(),
        spot_market_vault: ctx.accounts.spot_market_vault.to_account_info(),
        user_token_account: ctx.accounts.user_vault_token_account.to_account_info(), // TODO: this is the pda for the user token account
        token_program: ctx.accounts.token_program.to_account_info(),
        drift_signer: ctx.accounts.drift_signer.to_account_info(),
    };

    // let remaining_accounts = ctx.remaining_accounts.to_vec();
    // Drift Deposit CPI Call
    let cpi_ctx = CpiContext::new_with_signer(drift_program, cpi_accounts, signer_seeds)
        .with_remaining_accounts(ctx.remaining_accounts.to_vec());

    // cpi_ctx = cpi_ctx.with_remaining_accounts(remaining_accounts);
    drift::cpi::withdraw(cpi_ctx, market_index, amount, false)?;

    // Update the users position data.
    let user_state = &mut ctx.accounts.user_state;
    let user_token_vault = &mut ctx.accounts.user_token_vault;

    update_user_position(
        user_state,
        user_token_vault,
        user_token_vault.key(),
        ctx.accounts.user_vault_token_account.key(),
        ctx.accounts.drift_program.key(),
        ctx.accounts.spot_market_vault.key(),
        vault_index,
        amount,
        true,
    )?;

    Ok(())
}
