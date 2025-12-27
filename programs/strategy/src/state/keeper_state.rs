use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct KeeperState {
    pub keeper: Pubkey,
    pub credits: u64,
    pub padding: [u64; 7],
}

impl KeeperState{
    pub fn initialize(
        &mut self,
        keeper: &Pubkey,
    ){
        self.keeper = *keeper;
        self.credits = 0u64;
        self.padding = [0u64; 7];
    }

    pub fn reset_credits(&mut self){
        self.credits = 0;
    }
}

#[test]
fn test_keeper_state(){
    let _ = KeeperState{
        keeper:Pubkey::default(),
        credits:u64::default(),
        padding:[0u64;7]
    };
}