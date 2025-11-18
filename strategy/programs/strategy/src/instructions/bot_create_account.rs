use anchor_lang::prelude::*;
use crate::{constants::KEEPER_STATE, state::KeeperState};


#[derive(Accounts)]
pub struct KeeperCreateAccounts<'info> {
    /// The keeper state, stores the keeper account's key and credits
    #[account(
        init,
        payer = payer,
        space = KeeperState::DISCRIMINATOR.len() + KeeperState::INIT_SPACE,
        seeds = [KEEPER_STATE, keeper.key().as_ref()],
        bump
    )]
    pub keeper_account: Account<'info, KeeperState>,

    /// The payer account
    #[account(
        mut
    )]
    pub payer: Signer<'info>,

    /// CHECK: The keeper account
    pub keeper: UncheckedAccount<'info>,

    /// The system program, required for creating accounts
    pub system_program: Program<'info, System>
}

pub fn create_keeper_account_handler(
    ctx: Context<KeeperCreateAccounts>
) -> Result<()> {
    ctx.accounts.keeper_account.initialize(
        &ctx.accounts.keeper.key(),
    );

    Ok(())
}