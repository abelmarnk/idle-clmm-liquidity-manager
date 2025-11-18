use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use crate::{constants::{WHITELIST_STATE}, error::StrategyError, state::{GlobalState, WhitelistState}};


#[derive(Accounts)]
pub struct AdminWhitelistMintAccounts<'info> {
    /// The global state, stores global wide config
    pub global_state: Account<'info, GlobalState>,

    /// The whitelist state, stores the whitelisted mint
    #[account(
        init,
        payer = admin,
        space = WhitelistState::DISCRIMINATOR.len() + WhitelistState::INIT_SPACE,
        seeds = [WHITELIST_STATE, mint.key().as_ref()],
        bump
    )]
    pub whitelist_state: Account<'info, WhitelistState>,

    /// The mint to whitelist
    pub mint: Account<'info, Mint>,
   
    /// The admin
    #[account(
        mut
    )]
    pub admin: Signer<'info>,

    /// The system program, required for creating accounts
    pub system_program: Program<'info, System>,
}

pub fn admin_whitelist_mint_handler(
    ctx: Context<AdminWhitelistMintAccounts>,
) -> Result<()> {
    require_keys_eq!(
        *ctx.accounts.admin.key, 
        ctx.accounts.global_state.admin, 
        StrategyError::UnauthorizedAction
    );

    ctx.accounts.whitelist_state.initialize(
        &ctx.accounts.mint.key(),
    );

    Ok(())
}