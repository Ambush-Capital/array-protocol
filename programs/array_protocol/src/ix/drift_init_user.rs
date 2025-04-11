use crate::state::User;
use crate::{drift, get_user_seeds};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenInterface;
use drift::program::Drift;

#[derive(Accounts)]
#[instruction(sub_account_id: u16)]
pub struct InitDriftUser<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut)]
    pub user_state: Account<'info, User>,

    /// CHECK: target program handles
    #[account(mut)]
    pub drift_state: AccountInfo<'info>,

    /// CHECK: target program handles
    #[account(mut)]
    pub drift_user: AccountInfo<'info>,

    /// CHECK: target program handles
    #[account(mut)]
    pub drift_user_stats: AccountInfo<'info>,

    /// CHECK: program signer
    pub array_signer: AccountInfo<'info>,

    /// Drift Program
    pub drift_program: Program<'info, Drift>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_init_drift_user(ctx: Context<InitDriftUser>, sub_account_id: u16) -> Result<()> {
    let drift_program = &ctx.accounts.drift_program;

    let seeds = get_user_seeds(
        &ctx.accounts.user_state.authority,
        &ctx.accounts.user_state.bump,
    );
    let signer_seeds = &[&seeds[..]];

    msg!(
        "state: {}, user_state: {}, authority: {}, user_state: {}",
        ctx.accounts.drift_state.key(),
        ctx.accounts.user_state.key(),
        ctx.accounts.user_state.authority.key(),
        ctx.accounts.user_state.key(),
    );

    let init_ctx = CpiContext::new_with_signer(
        drift_program.to_account_info(),
        drift::cpi::accounts::InitializeUser {
            user: ctx.accounts.drift_user.to_account_info(),
            user_stats: ctx.accounts.drift_user_stats.to_account_info(),
            state: ctx.accounts.drift_state.to_account_info(),
            authority: ctx.accounts.user_state.to_account_info(),
            payer: ctx.accounts.signer.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        },
        signer_seeds,
    );

    drift::cpi::initialize_user(init_ctx, sub_account_id, [0u8; 32])?;

    Ok(())
}
