use crate::state::{SupportedTokenVault, User, UserTokenVault};
use anchor_lang::prelude::*;
use anchor_spl::token::TransferChecked;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

/// Accounts for `deposit_spl`.
/// To do a deposit we will need the following:
/// 1. The signer account: this is the user, we are depositing into the protocol
/// 2. The token vault mint account --> this is the mint account for the token of the token vault
/// 3. The user state account --> this is the user's state account, we can update the position for the token vault
/// 4. The user token account --> this is the user's token account, we will transfer the tokens to this pda
/// 4. The user token vault --> this is the object for the user's token account, this helps us keep track of their position / positions in protocols
/// 5. The protocol vault account --> this is to track the protocol level of the balance for the token vault
#[derive(Accounts)]
#[instruction(vault_index: u16)]
pub struct DepositSpl<'info> {
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

    /// CHECK: program signer
    pub array_signer: AccountInfo<'info>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
}

/// Handler function for `deposit_spl`.
pub fn handle_deposit_spl(ctx: Context<DepositSpl>, _vault_index: u16, amount: u64) -> Result<()> {
    let token_program = &ctx.accounts.token_program;
    let decimals = ctx.accounts.token_vault_mint.decimals;

    let cpi_accounts = TransferChecked {
        mint: ctx.accounts.token_vault_mint.to_account_info(),
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.user_vault_token_account.to_account_info(),
        authority: ctx.accounts.signer.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(token_program.to_account_info(), cpi_accounts);

    anchor_spl::token::transfer_checked(cpi_ctx, amount, decimals)?;

    // 2) Update vault global balance
    let vault_state = &mut ctx.accounts.protocol_token_vault;
    vault_state.balance = vault_state
        .balance
        .checked_add(amount as u128)
        .ok_or(crate::controller::errors::VaultError::Overflow)?;

    // 3) Update user position
    let user_token_vault = &mut ctx.accounts.user_token_vault;
    user_token_vault.deposited_amount = user_token_vault
        .deposited_amount
        .checked_add(amount as u128)
        .ok_or(crate::controller::errors::VaultError::Overflow)?;

    Ok(())
}
