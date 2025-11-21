use anchor_lang::prelude::*;
use anchor_spl::token_interface::{TokenAccount, TokenInterface, Mint};
use crate::{state::GlobalState, error::StrategyError, helpers::{transfer_token}, constants::GLOBAL_STATE};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AdminWithdrawTokenArgs {
    // Amount of token to withdraw
    pub amount: u64,
}

#[derive(Accounts)]
pub struct AdminWithdrawTokenAccounts<'info> {
    /// The global state, stores global wide config
    pub global_state: Account<'info, GlobalState>,

    /// The admin
    pub admin: Signer<'info>,

    /// The source token account
    #[account(
        mut
    )]
    pub source_token_account: InterfaceAccount<'info, TokenAccount>,

    /// The token mint(for transfer_checked)
    pub mint: InterfaceAccount<'info, Mint>,

    /// The destination token account
    #[account(
        mut
    )]
    pub destination_token_account: InterfaceAccount<'info, TokenAccount>,

    /// The token prorgam for transfers
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn admin_withdraw_tokens_handler(
    ctx: Context<AdminWithdrawTokenAccounts>,
    args: AdminWithdrawTokenArgs,
) -> Result<()> {
    require_keys_eq!(
        *ctx.accounts.admin.key, 
        ctx.accounts.global_state.admin, 
        StrategyError::UnauthorizedAction
    );

    transfer_token(
        ctx.accounts.global_state.to_account_info(),
        ctx.accounts.source_token_account.to_account_info(),
        ctx.accounts.mint.to_account_info(),
        ctx.accounts.destination_token_account.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
        args.amount,
        ctx.accounts.mint.decimals,
        &[&[
            GLOBAL_STATE, 
            &[ctx.accounts.global_state.bump]
        ]],
    )
}