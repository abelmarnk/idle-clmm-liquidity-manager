use std::ops::{Add, Div, Sub};

use anchor_lang::prelude::*;
use crate::{constants::ALL_BASIS_POINTS, error::StrategyError, state::KeeperState};

#[account]
#[derive(InitSpace)]
pub struct GlobalState{

    pub state:u8, 

    pub admin:Pubkey,

    pub sol_vault:Pubkey,

    pub credits_for_decrease_liquidity:u64, // This is how many credits are needed before a decrease_liquidity_position
                                    // action can be performed by the bot

    pub credits_for_increase_liquidity:u64, // This is how many credits are needed before a increase_liquidity_position
                                    // action can be performed by the bot

    pub sol_per_credit:u64, // This is how much SOL each credit costs

    pub base_deposit: u64,

    pub fee_basis_points:u16,

    pub bump:u8,

    pub sol_vault_bump:u8
}

impl GlobalState{

    pub const CAN_CREATE_POSITION:u8 = 1 << 0;
    
    pub const CAN_INCREASE_POSITION:u8 = 1 << 1;

    pub const CAN_DECREASE_POSITION:u8 = 1 << 2;    

    pub fn can_create_position(&self)->bool{
        (self.state & GlobalState::CAN_CREATE_POSITION).ne(&0)
    }

    pub fn can_increase_position(&self)->bool{
        (self.state & GlobalState::CAN_INCREASE_POSITION).ne(&0)
    }

    pub fn can_decrease_position(&self)->bool{
        (self.state & GlobalState::CAN_DECREASE_POSITION).ne(&0)
    }

    pub fn add_decrease_liquidity_credits_for_keeper(&self, keeper:&mut Account<'_, KeeperState>)->Result<()>{
        keeper.credits = keeper.credits.add(self.credits_for_decrease_liquidity);
        Ok(())
    }

    pub fn add_increase_liquidity_credits_for_keeper(&self, keeper:&mut Account<'_, KeeperState>, is_out_of_range:bool)->Result<()>{
        let credits = if is_out_of_range {self.credits_for_increase_liquidity} else {self.credits_for_increase_liquidity.div(2)};
        keeper.credits = keeper.credits.add(credits);
        Ok(())
    }

    pub fn get_amount(&self, amount_before: u64, amount_after: u64) -> Result<u64> {
        if amount_before >= amount_after {
            // No fee, just return amount_before and zero fee
            Ok(amount_before)
        } else {
            // Calculate fee on the increase
            let diff = amount_after.sub(amount_before);
            let fee = diff.checked_mul(u64::from(self.fee_basis_points))
                .and_then(|v| v.checked_div(ALL_BASIS_POINTS))
                .ok_or(StrategyError::NumericalOverflow)?;
            Ok(amount_after.sub(fee))
        }
    }

    pub fn initialize(
            &mut self,
            admin: &Pubkey,
            sol_vault: &Pubkey,
            state: u8,
            credits_for_decrease_liquidity: u64,
            credits_for_increase_liquidity: u64,
            sol_per_credit: u64,
            base_deposit: u64,
            fee_basis_points:u16,
            bump: u8,
            sol_vault_bump: u8,
        ) {
            self.state = state;
            self.admin = *admin;
            self.sol_vault = *sol_vault;
            self.credits_for_decrease_liquidity = credits_for_decrease_liquidity;
            self.credits_for_increase_liquidity = credits_for_increase_liquidity;
            self.sol_per_credit = sol_per_credit;
            self.base_deposit = base_deposit;
            self.fee_basis_points = fee_basis_points;
            self.bump = bump;
            self.sol_vault_bump = sol_vault_bump;
    }
}


#[account]
#[derive(InitSpace)]
pub struct WhitelistState{
    pub mint:Pubkey
}

impl WhitelistState {
    pub fn initialize(&mut self, mint:&Pubkey) {
        self.mint = *mint;
    }
}

#[test]
fn test_global_state(){
    let _ = GlobalState{
        state: u8::default(),
        admin: Pubkey::default(),
        sol_vault: Pubkey::default(),
        credits_for_decrease_liquidity: u64::default(),
        credits_for_increase_liquidity: u64::default(),
        sol_per_credit: u64::default(),
        base_deposit: u64::default(),
        fee_basis_points: u16::default(),
        bump: u8::default(),
        sol_vault_bump: u8::default()
    };
}

#[test]
fn test_whitelist_state(){
    _ = WhitelistState{
        mint: Pubkey::default()
    }
}
