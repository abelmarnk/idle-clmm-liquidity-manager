use anchor_lang::prelude::*;
use crate::state::GlobalState;
use crate::error::StrategyError;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum AdminChange {
    CreditsForDecrease { value: u64 },
    CreditsForIncrease { value: u64 },
    SolPerCredit { value: u64 },
    BaseDeposit { value: u64 },
    FeeBasisPoints{ value: u16 },
    StateBit { bit: u8, set: bool },
    SetAdmin { new_admin: Pubkey },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct AdminChangeConfigArgs {
    pub change: AdminChange
}

#[derive(Accounts)]
pub struct AdminChangeConfigAccounts<'info> {
    /// The global state, stores global wide config
    #[account(
        mut
    )]
    pub global_state: Account<'info, GlobalState>,

    /// The admin
    #[account(
        mut
    )]
    pub admin: Signer<'info>,

    /// The system program, Required if we resize the whitelist
    pub system_program: Program<'info, System>,
}

pub fn admin_change_config_handler(
    ctx: Context<AdminChangeConfigAccounts>,
    args: AdminChangeConfigArgs,
) -> Result<()> {
    if ctx.accounts.admin.key.ne(&ctx.accounts.global_state.admin) {
        return Err(StrategyError::UnauthorizedAction.into());
    }

    let global_state = &mut ctx.accounts.global_state;

    let clock = Clock::get()?;

    match args.change {
        AdminChange::CreditsForDecrease { value } => {
            global_state.credits_for_decrease_liquidity = value;
            emit!(crate::CreditsForDecreaseEvent { admin: ctx.accounts.admin.key(), global_state: ctx.accounts.global_state.key(), value, timestamp: clock.unix_timestamp });
        }
        AdminChange::CreditsForIncrease { value } => {
            global_state.credits_for_increase_liquidity = value;
            emit!(crate::CreditsForIncreaseEvent { admin: ctx.accounts.admin.key(), global_state: ctx.accounts.global_state.key(), value, timestamp: clock.unix_timestamp });
        }
        AdminChange::SolPerCredit { value } => {
            global_state.sol_per_credit = value;
            emit!(crate::SolPerCreditEvent { admin: ctx.accounts.admin.key(), global_state: ctx.accounts.global_state.key(), value, timestamp: clock.unix_timestamp });
        }
        AdminChange::BaseDeposit { value } => {
            global_state.base_deposit = value;
            emit!(crate::BaseDepositEvent { admin: ctx.accounts.admin.key(), global_state: ctx.accounts.global_state.key(), value, timestamp: clock.unix_timestamp });
        }
        AdminChange::FeeBasisPoints { value } => {
            global_state.fee_basis_points = value;
            emit!(crate::FeeBasisPointsEvent { admin: ctx.accounts.admin.key(), global_state: ctx.accounts.global_state.key(), value, timestamp: clock.unix_timestamp });
        }
        AdminChange::StateBit { bit, set } => {
            if bit.ge(&8) {
                return Err(ProgramError::InvalidArgument.into());
            }

            if set {
                global_state.state |= 1 << bit;
            } else {
                global_state.state &= !(1 << bit);
            }
            emit!(crate::StateBitEvent { admin: ctx.accounts.admin.key(), global_state: ctx.accounts.global_state.key(), bit, set, timestamp: clock.unix_timestamp });
        }
        AdminChange::SetAdmin { new_admin } => {
            global_state.admin = new_admin;
            emit!(crate::SetAdminEvent { admin: ctx.accounts.admin.key(), global_state: ctx.accounts.global_state.key(), new_admin, timestamp: clock.unix_timestamp });
        }
    }

    Ok(())
}