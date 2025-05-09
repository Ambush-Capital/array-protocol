use crate::state::{Size, User};
use crate::ROBOT_PUBKEY;
use anchor_lang::prelude::*;

/// Accounts for the `create_user` instruction.
#[derive(Accounts)]
pub struct InitUser<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    /// We create the `User` PDA with seeds = [ "user", authorityPubkey ].
    /// The bump is automatically found by Anchor, and we store it in the `User` struct.
    #[account(
        init,
        payer = signer,
        // Enough space for the user: 
        // 8 (discriminator) + 1(bump) + 32(authority) + 32(delegate) + 8*(Position ~16 bytes) 
        space = User::SIZE,
        seeds = [b"user", signer.key().as_ref()],
        bump
    )]
    pub user_state: Account<'info, User>,

    pub system_program: Program<'info, System>,
}

/// Handler function for `create_user`.
pub fn handle_init_user(ctx: Context<InitUser>) -> Result<()> {
    let user_state = &mut ctx.accounts.user_state;

    user_state.authority = ctx.accounts.signer.key();
    user_state.delegate = ROBOT_PUBKEY;
    user_state.positions = [Default::default(); 8];
    user_state.bump = ctx.bumps.user_state;

    Ok(())
}
