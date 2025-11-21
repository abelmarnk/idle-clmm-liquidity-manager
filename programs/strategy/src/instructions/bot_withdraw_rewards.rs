use anchor_lang::{prelude::*};
use crate::{state::{GlobalState, KeeperState}, error::StrategyError};

#[derive(Accounts)]
pub struct KeeperWithdrawRewardsAccounts<'info> {
    /// The keeper state, stores the keeper account's key and credits    
    #[account(
        mut
    )]
    pub keeper_account: Account<'info, KeeperState>,

    /// The keeper
    pub keeper: Signer<'info>,

    /// The recipient
    /// CHECK: RECIPIENT
    #[account(
        mut
    )]
    pub recipient: UncheckedAccount<'info>,    

    /// The global state, stores global wide config
    pub global_state: Account<'info, GlobalState>,

    /// The sol vault, stores the SOL used to pay off keepers
    /// CHECK: SOL-VAULT
    #[account(
        mut
    )]
    pub sol_vault: UncheckedAccount<'info>,
}

pub fn keeper_withdraw_rewards_handler(
    ctx: Context<KeeperWithdrawRewardsAccounts>
) -> Result<()> {
    require_keys_eq!(
        ctx.accounts.keeper_account.keeper,
        *ctx.accounts.keeper.key,
        StrategyError::UnauthorizedAction
    );

    // Get withdraw amount
    let credits = ctx.accounts.keeper_account.credits;

    let amount = ctx.accounts
        .global_state
        .sol_per_credit
        .checked_mul(credits)
        .ok_or(ProgramError::ArithmeticOverflow)?;

    ctx.accounts.sol_vault.sub_lamports(amount)?;
    ctx.accounts.recipient.add_lamports(amount)?;

    ctx.accounts.keeper_account.reset_credits();

    Ok(())
}