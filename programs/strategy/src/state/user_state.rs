use anchor_lang::prelude::*;

/// Store the state relevant to the user's position
#[account]
#[derive(InitSpace)]
pub struct UserState{

    // The owner of this position
    pub user:Pubkey, 

    // The mint for the user's NFT which represents their position in the
    // raydium program
    pub user_mint:Pubkey,

    // Stores the token which was deployed to meteora, it is reset when the position
    // is returned to raydium
    pub token_deployed:TokenDeployed,

    // This is the amount that was deposited into meteora's vault we would later 
    // take the difference to know how much fees we should collect, it is reset
    // when the position is returned to raydium
    pub amount_deposited_into_vault:u64,

    // The lower and upper tick index, it can't go stale because we hold the position
    pub tick_lower_index:i32,
    pub tick_upper_index:i32,

    // Stores the liquidity last removed from raydium, each time it is removed and
    // put back it would not be less than what was pulled out
    pub liquidity:u128,

    // The amount of lp tokens from the last meteora deposit, it is reset after the 
    // position is returned to raydium
    pub lp_amount:u64,

    // The tick lower bound that has to be hit before the deposit action from
    // the bot can be triggered
    pub tick_lower_index_out_threshold: i32,

    // The tick upper bound that has to be hit before the deposit action from
    // the bot can be triggered    
    pub tick_upper_index_out_threshold: i32,

    // The tick lower bound that has to be hit before the deposit action from
    // the bot can be triggered
    pub tick_lower_index_in_threshold: i32,

    // The tick upper bound that has to be hit before the deposit action from
    // the bot can be triggered    
    pub tick_upper_index_in_threshold: i32,

    // The account bump
    pub bump:u8,

    pub reserved:[u8;127] // Reserved for future use
}

pub enum LpTokenState{
    Token0,
    Token1,
    NotOutOfRange
}

#[derive(
    AnchorSerialize, AnchorDeserialize, InitSpace, 
    Clone, Copy, PartialEq, Eq
)]
pub enum TokenDeployed{
    Token0,
    Token1,
    NoTokenDeployed
}

impl UserState {
    pub fn initialize(
        &mut self,
        user: &Pubkey,
        tick_lower_index:i32,
        tick_upper_index:i32,
        tick_lower_index_in_threshold: i32,
        tick_upper_index_in_threshold: i32,
        tick_lower_index_out_threshold: i32,
        tick_upper_index_out_threshold: i32,
        user_mint: &Pubkey,
        bump: u8,
    ) {
        self.user = *user;
        self.tick_lower_index = tick_lower_index;
        self.tick_upper_index = tick_upper_index;
        self.tick_lower_index_in_threshold = tick_lower_index_in_threshold;
        self.tick_upper_index_in_threshold = tick_upper_index_in_threshold;
        self.tick_lower_index_out_threshold = tick_lower_index_out_threshold;
        self.tick_upper_index_out_threshold = tick_upper_index_out_threshold;
        self.token_deployed = TokenDeployed::NoTokenDeployed;
        self.user_mint = *user_mint;
        self.bump = bump;
        self.amount_deposited_into_vault = 0;
        self.liquidity = 0;
    }

    pub fn is_tick_within_range(&self, current_tick:i32)->bool{
        current_tick.ge(&self.tick_lower_index) &&
        current_tick.le(&self.tick_upper_index)
    }

    pub fn is_tick_within_in_threshold_range(&self, current_tick:i32)->bool{
        current_tick.ge(&self.tick_lower_index_in_threshold) &&
        current_tick.le(&self.tick_upper_index_in_threshold)
    }

    pub fn get_deployed_state(&self)->TokenDeployed{
        self.token_deployed
    }

    pub fn get_lp_token_state(&self, current_tick:i32)->LpTokenState{
        if current_tick.lt(&self.tick_lower_index_out_threshold){
            LpTokenState::Token0
        } else if current_tick.gt(&self.tick_upper_index_out_threshold){
            LpTokenState::Token1
        } else {
            LpTokenState::NotOutOfRange
        }
    }

    pub fn set_deployed(&mut self, liquidity:u128, amount_deposited_into_vault:u64, lp_amount:u64, token_deployed:TokenDeployed){
        self.liquidity = liquidity;
        self.amount_deposited_into_vault = amount_deposited_into_vault;
        self.lp_amount = lp_amount;
        self.token_deployed = token_deployed;
    }

    pub fn set_not_deployed(&mut self){
        self.liquidity = 0;
        self.lp_amount = 0;
        self.amount_deposited_into_vault = 0;
        self.token_deployed = TokenDeployed::NoTokenDeployed;
    }

    pub fn is_deployed(&self)->bool{
        self.token_deployed.ne(&TokenDeployed::NoTokenDeployed)
    }

    pub fn set_into(&self, account:&AccountInfo<'_>)->Result<()>{
        self.try_serialize(&mut &mut account.try_borrow_mut_data()?[..])?;
        Ok(())
    }
}

#[test]
fn test_user_state() {
    let _ = UserState {
        user: Pubkey::default(),
        user_mint: Pubkey::default(),
        token_deployed: TokenDeployed::NoTokenDeployed,
        amount_deposited_into_vault: u64::default(),
        tick_lower_index: i32::default(),
        tick_upper_index: i32::default(),
        liquidity: u128::default(),
        lp_amount: u64::default(),
        tick_lower_index_out_threshold: i32::default(),
        tick_upper_index_out_threshold: i32::default(),
        tick_lower_index_in_threshold: i32::default(),
        tick_upper_index_in_threshold: i32::default(),
        bump: u8::default(),
        reserved: [0u8; 127],
    };
}