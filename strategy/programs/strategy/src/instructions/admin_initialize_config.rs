use anchor_lang::prelude::*;
use crate::{constants::{GLOBAL_STATE, SOL_VAULT}, state::GlobalState};

const BOOTSTRAP_KEY:Pubkey = pubkey!("F2yJnhaEM1KSuJYDy2DHe2oHqZep1F8NKaHTZyvFyX6S");

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AdminInitializeConfigArgs {
    /// Initial state of the program
    pub state: u8,
    /// Credits given to the bot for performing the decrease liquiidty action
    pub credits_for_decrease_liquidity: u64,
    /// Credits given to the bot for performing the increase liquiidty action    
    pub credits_for_increase_liquidity: u64,
    /// The SOL for each credit
    pub sol_per_credit: u64,
    /// The base deposit user's(LPs) pay when creating accounts to nudge against fragmentation    
    pub base_deposit: u64,
    /// How much of yield is taken by the program
    pub fee_basis_points: u16
}

#[derive(Accounts)]
pub struct AdminInitializeConfigAccounts<'info> {
    /// The global state, stores global wide config
    #[account(
        init,
        payer = admin,
        space = GlobalState::DISCRIMINATOR.len() + GlobalState::INIT_SPACE,
        seeds = [GLOBAL_STATE],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,

    /// The sol vault, stores the SOL used to pay off keepers
    /// CHECK: SOL-VAULT
    #[account(
        init,
        payer = admin,
        space = 0,
        seeds = [SOL_VAULT],
        bump
    )]
    pub sol_vault: UncheckedAccount<'info>,

    /// The initializer, used to ensure only the admin can call this instruction
    #[account(
        address = BOOTSTRAP_KEY
    )]
    pub initializer:Signer<'info>,

    /// The admin
    #[account(
        mut
    )]
    pub admin: Signer<'info>,

    /// The system program, required for creating accounts
    pub system_program: Program<'info, System>,
}

pub fn admin_initialize_config_handler(
    ctx: Context<AdminInitializeConfigAccounts>,
    args: AdminInitializeConfigArgs,
) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;

    global_state.initialize(
        ctx.accounts.admin.key,
        ctx.accounts.sol_vault.key,
        args.state,
        args.credits_for_decrease_liquidity,
        args.credits_for_increase_liquidity,
        args.sol_per_credit,
        args.base_deposit,
        args.fee_basis_points,
        ctx.bumps.global_state,
        ctx.bumps.sol_vault,
    );

    Ok(())
}