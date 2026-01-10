use anchor_lang::prelude::*;

// Events for admin initialization and configuration
#[event]
pub struct AdminInitializeConfigEvent {
    pub admin: Pubkey,
    pub global_state: Pubkey,
    pub sol_vault: Pubkey,
    pub state: u8,
    pub credits_for_decrease_liquidity: u64,
    pub credits_for_increase_liquidity: u64,
    pub sol_per_credit: u64,
    pub base_deposit: u64,
    pub fee_basis_points: u16,
    pub timestamp: i64,
}

#[event]
pub struct CreditsForDecreaseEvent {
    pub admin: Pubkey,
    pub global_state: Pubkey,
    pub value: u64,
    pub timestamp: i64,
}

#[event]
pub struct CreditsForIncreaseEvent {
    pub admin: Pubkey,
    pub global_state: Pubkey,
    pub value: u64,
    pub timestamp: i64,
}

#[event]
pub struct SolPerCreditEvent {
    pub admin: Pubkey,
    pub global_state: Pubkey,
    pub value: u64,
    pub timestamp: i64,
}

#[event]
pub struct BaseDepositEvent {
    pub admin: Pubkey,
    pub global_state: Pubkey,
    pub value: u64,
    pub timestamp: i64,
}

#[event]
pub struct FeeBasisPointsEvent {
    pub admin: Pubkey,
    pub global_state: Pubkey,
    pub value: u16,
    pub timestamp: i64,
}

#[event]
pub struct StateBitEvent {
    pub admin: Pubkey,
    pub global_state: Pubkey,
    pub bit: u8,
    pub set: bool,
    pub timestamp: i64,
}

#[event]
pub struct SetAdminEvent {
    pub admin: Pubkey,
    pub global_state: Pubkey,
    pub new_admin: Pubkey,
    pub timestamp: i64,
}

// Whitelist events
#[event]
pub struct AdminWhitelistMintEvent {
    pub admin: Pubkey,
    pub global_state: Pubkey,
    pub whitelist_state: Pubkey,
    pub mint: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AdminUnwhitelistMintEvent {
    pub admin: Pubkey,
    pub global_state: Pubkey,
    pub whitelist_state: Pubkey,
    pub mint: Pubkey,
    pub timestamp: i64,
}

// Withdraw events
#[event]
pub struct AdminWithdrawSolEvent {
    pub admin: Pubkey,
    pub global_state: Pubkey,
    pub sol_vault: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct AdminWithdrawTokensEvent {
    pub admin: Pubkey,
    pub global_state: Pubkey,
    pub source_token_account: Pubkey,
    pub destination_token_account: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

// Keeper / bot events
#[event]
pub struct KeeperCreateEvent {
    pub payer: Pubkey,
    pub keeper_account: Pubkey,
    pub keeper: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct KeeperIncreaseLiquidityPositionEvent {
    pub keeper_account: Pubkey,
    pub user_state: Pubkey,
    pub token_amount_min: u64,
    pub withdraw_amount: u64,
    pub is_out_of_range: bool,
    pub timestamp: i64,
}

#[event]
pub struct KeeperDecreaseLiquidityPositionEvent {
    pub keeper_account: Pubkey,
    pub user_state: Pubkey,
    pub liquidity_removed: u128,
    pub deposited_amount: u64,
    pub lp_amount: u64,
    pub token_deployed: u8,
    pub timestamp: i64,
}

#[event]
pub struct KeeperWithdrawRewardsEvent {
    pub keeper_account: Pubkey,
    pub recipient: Pubkey,
    pub credits: u64,
    pub amount: u64,
    pub timestamp: i64,
}

// User events
#[event]
pub struct UserCreatePositionEvent {
    pub payer: Pubkey,
    pub user: Pubkey,
    pub user_state: Pubkey,
    pub user_mint: Pubkey,
    pub pool: Pubkey,
    pub tick_lower_index_in_threshold: i32,
    pub tick_upper_index_in_threshold: i32,
    pub tick_lower_index_out_threshold: i32,
    pub tick_upper_index_out_threshold: i32,
    pub timestamp: i64,
}

#[event]
pub struct UserClosePositionEvent {
    pub user: Pubkey,
    pub user_state: Pubkey,
    pub nft_mint: Pubkey,
    pub token_amount_min: u64,
    pub closed_was_deployed: bool,
    pub timestamp: i64,
}
