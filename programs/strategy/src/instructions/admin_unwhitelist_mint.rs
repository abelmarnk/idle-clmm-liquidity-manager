use anchor_lang::prelude::*;
use crate::{error::StrategyError, state::{GlobalState, WhitelistState}};


#[derive(Accounts)]
pub struct AdminUnwhitelistMintAccounts<'info> {
    /// The global state, stores global wide config

    pub global_state: Account<'info, GlobalState>,

    /// The whitelist state, stores the whitelisted mint
    #[account(
        mut,
        close = admin
    )]
    pub whitelist_state: Account<'info, WhitelistState>,
   
    /// The admin
    #[account(
        mut
    )]
    pub admin: Signer<'info>,

    /// The system program, required for creating accounts
    pub system_program: Program<'info, System>,
}

pub fn admin_unwhitelist_mint_handler(
    ctx: Context<AdminUnwhitelistMintAccounts>,
) -> Result<()> {
    require_keys_eq!(
        *ctx.accounts.admin.key, 
        ctx.accounts.global_state.admin, 
        StrategyError::UnauthorizedAction
    );

    Ok(())
}