use anchor_lang::prelude::*;
use crate::{state::GlobalState, error::StrategyError};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AdminWithdrawSolArgs {
    // Amount of SOL to withdraw
    pub amount: u64,
}

#[derive(Accounts)]
pub struct AdminWithdrawSolAccounts<'info> {
    /// The global state, stores global wide config
    #[account(
        mut
    )]
    pub global_state: Account<'info, GlobalState>,

    /// The admin
    pub admin: Signer<'info>,

    /// The sol vault
    /// CHECK: SOL-VAULT
    #[account(
        mut
    )]
    pub sol_vault: UncheckedAccount<'info>,

    /// The recipient
    /// CHECK: RECIPIENT
    #[account(
        mut
    )]
    pub recipient: UncheckedAccount<'info>,
}

pub fn admin_withdraw_sol_handler(
    ctx: Context<AdminWithdrawSolAccounts>,
    args: AdminWithdrawSolArgs,
) -> Result<()> {
    require_keys_eq!(
        *ctx.accounts.admin.key, 
        ctx.accounts.global_state.admin, 
        StrategyError::UnauthorizedAction
    );

    msg!("Recipient pre-withdrawal balance: {} lamports", ctx.accounts.recipient.lamports());
    msg!("Withdrawing {} lamports from SOL vault to recipient", args.amount);

    ctx.accounts.sol_vault.sub_lamports(args.amount)?;
    ctx.accounts.recipient.add_lamports(args.amount)?;
    
    Ok(())
}