use crate::get_user_seeds;
use crate::state::{ProgramState, SupportedTokenVault, User, UserTokenVault};
use anchor_lang::prelude::*;
use anchor_spl::token::TransferChecked;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
#[instruction(vault_index: u16)]
pub struct WithdrawSpl<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(owner = token_program.key())]
    pub token_vault_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub user_state: Account<'info, User>,

    #[account(
        mut,
        token::authority = signer
    )]
    pub user_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

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

    /// TokenVault metadata
    #[account(
        mut,
        seeds = [b"token_vault".as_ref(), vault_index.to_le_bytes().as_ref()],
        bump
    )]
    pub protocol_token_vault: Account<'info, SupportedTokenVault>,

    #[account()]
    pub state: Box<Account<'info, ProgramState>>,

    /// CHECK: program signer
    pub array_signer: AccountInfo<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_withdraw_spl(
    ctx: Context<WithdrawSpl>,
    _vault_index: u16,
    amount: u64,
) -> Result<()> {
    // let token_vault = ctx.accounts.token_vault.load()?;

    let seeds = get_user_seeds(
        &ctx.accounts.user_state.authority,
        &ctx.accounts.user_state.bump,
    );
    let signer_seeds = &[&seeds[..]];

    let decimals = ctx.accounts.token_vault_mint.decimals;
    // 1) Transfer from vault -> user
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        TransferChecked {
            mint: ctx.accounts.token_vault_mint.to_account_info(),
            from: ctx.accounts.user_vault_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.user_state.to_account_info(),
        },
        signer_seeds,
    );
    anchor_spl::token::transfer_checked(cpi_ctx, amount, decimals)?;

    // 2) Subtract from vault global balance
    let vault_state = &mut ctx.accounts.protocol_token_vault;
    vault_state.balance = vault_state
        .balance
        .checked_sub(amount as u128)
        .ok_or(crate::controller::errors::VaultError::Underflow)?;

    // 3) Update user position

    let user_token_vault = &mut ctx.accounts.user_token_vault;
    user_token_vault.deposited_amount = user_token_vault
        .deposited_amount
        .checked_sub(amount as u128)
        .ok_or(crate::controller::errors::VaultError::Underflow)?;

    Ok(())
}
