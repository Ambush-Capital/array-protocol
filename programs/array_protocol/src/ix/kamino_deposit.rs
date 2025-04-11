use crate::controller::update_user_position;
use crate::get_user_seeds;
use crate::klend::program::KaminoLending;
use crate::state::{SupportedTokenVault, User, UserTokenVault};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::{instructions::Instructions, SysvarId};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(Accounts)]
#[instruction(vault_index: u16)]
pub struct KaminoDeposit<'info> {
    // #[account(mut)]
    pub signer: Signer<'info>,

    #[account(owner = token_program.key())]
    //reserve_collateral_mint & reserve_liquidity_mint (they are the same)
    pub token_vault_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut)]
    pub user_state: Box<Account<'info, User>>,

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
    pub user_vault_token_account: Box<InterfaceAccount<'info, TokenAccount>>, // user_source_liquidity

    #[account(
        mut,
        seeds = [b"user_vault".as_ref(), user_state.key().as_ref(), vault_index.to_le_bytes().as_ref()],
        bump,
    )]
    pub user_token_vault: Account<'info, UserTokenVault>,

    /// CHECK: target program handles
    #[account(mut)]
    pub obligation: AccountInfo<'info>,

    /// CHECK: target program handles
    pub lending_market: AccountInfo<'info>,

    /// CHECK: target program handles
    #[account()]
    pub lending_market_authority: AccountInfo<'info>,

    /// CHECK: target program handles
    #[account(mut)]
    pub reserve: AccountInfo<'info>,

    #[account(mut)]
    pub reserve_liquidity_supply: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut)]
    pub reserve_destination_deposit_collateral: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: target program handles
    #[account(address = Instructions::id())]
    pub instruction_sysvar_account: AccountInfo<'info>,

    /// CHECK: target program handles
    #[account(mut)]
    pub obligation_farm_user_state: AccountInfo<'info>,

    /// CHECK: target program handles
    #[account(mut)]
    pub reserve_farm_state: AccountInfo<'info>,
    // // pub farms_accounts: OptionalObligationFarmsAccounts<'info>,
    // pub farms_program: UncheckedAccount<'info>,
    /// Drift Program
    pub klend_program: Program<'info, KaminoLending>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handle_kamino_deposit<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, KaminoDeposit<'info>>,
    vault_index: u16,
    amount: u64,
) -> Result<()> {
    let kamino_program = ctx.accounts.klend_program.to_account_info();

    let seeds = get_user_seeds(
        &ctx.accounts.user_state.authority,
        &ctx.accounts.user_state.bump,
    );
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts =
        crate::klend::cpi::accounts::DepositReserveLiquidityAndObligationCollateral {
            owner: ctx.accounts.user_state.to_account_info(),
            obligation: ctx.accounts.obligation.to_account_info(),
            lending_market: ctx.accounts.lending_market.to_account_info(),
            lending_market_authority: ctx.accounts.lending_market_authority.to_account_info(),
            reserve: ctx.accounts.reserve.to_account_info(),
            reserve_liquidity_mint: ctx.accounts.token_vault_mint.to_account_info(),
            reserve_liquidity_supply: ctx.accounts.reserve_liquidity_supply.to_account_info(),
            reserve_collateral_mint: ctx.accounts.token_vault_mint.to_account_info(),
            reserve_destination_deposit_collateral: ctx
                .accounts
                .reserve_destination_deposit_collateral
                .to_account_info(),
            user_source_liquidity: ctx.accounts.user_vault_token_account.to_account_info(),
            placeholder_user_destination_collateral: None,
            collateral_token_program: ctx.accounts.token_program.to_account_info(),
            liquidity_token_program: ctx.accounts.token_program.to_account_info(),
            instruction_sysvar_account: ctx.accounts.instruction_sysvar_account.to_account_info(),
        };

    let cpi_ctx = CpiContext::new_with_signer(kamino_program, cpi_accounts, signer_seeds);

    crate::klend::cpi::deposit_reserve_liquidity_and_obligation_collateral(cpi_ctx, amount)?;

    // Update the users position data.
    let user_state = &mut ctx.accounts.user_state;
    let user_token_vault = &mut ctx.accounts.user_token_vault;

    update_user_position(
        user_state,
        user_token_vault,
        user_token_vault.key(),
        ctx.accounts.user_vault_token_account.key(),
        ctx.accounts.klend_program.key(),
        ctx.accounts.reserve.key(),
        vault_index,
        amount,
        false,
    )?;

    Ok(())
}
