use crate::ids::admin_hot_wallet;
use crate::state::ProgramState;
use crate::state::Size;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::TokenInterface;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        mut,
        constraint = admin.key() == admin_hot_wallet::id()
    )]
    pub admin: Signer<'info>,

    #[account(
        init,
        seeds = [b"array_program_state".as_ref()],
        space = ProgramState::SIZE,
        bump,
        payer = admin
    )]
    pub state: Account<'info, ProgramState>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_init_program_state(ctx: Context<Initialize>) -> Result<()> {
    let (array_signer_pda, bump) =
        Pubkey::find_program_address(&[b"array_signer".as_ref()], ctx.program_id);

    let program_state = &mut ctx.accounts.state;
    program_state.admin = ctx.accounts.admin.key();
    program_state.signer_pda = array_signer_pda;
    program_state.token_vault_count = 0;
    program_state.bump = bump;
    Ok(())
}
