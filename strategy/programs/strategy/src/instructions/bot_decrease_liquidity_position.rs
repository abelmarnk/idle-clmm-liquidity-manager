use std::ops::{Add, Sub};

use anchor_lang::{prelude::*, solana_program::{instruction::Instruction, program::invoke_signed}};
use anchor_spl::token_interface::{TokenAccount};
use raydium_amm_v3::{ID as RAYDIUM_CLMM_PROGRAM_ID, states::{PersonalPositionState, PoolState, TickArrayBitmapExtension}};
use crate::{constants::{GLOBAL_STATE, METEORA_DEPOSIT_GLOBAL_STATE_ACCOUNT_OFFSET, METEORA_DEPOSIT_GLOBAL_STATE_LP_ACCOUNT_OFFSET, METEORA_DEPOSIT_GLOBAL_STATE_TOKEN_ACCOUNT_OFFSET, METEORA_DEPOSIT_LIQUIDITY_ACCOUNTS_COUNT, METEORA_DEPOSIT_LP_MINT_ACCOUNT_OFFSET, METEORA_VAULT_DEPOSIT_DISCRIMINATOR, METEORA_VAULT_PROGRAM, RAYDIUM_DECREASE_LIQUIDITY_V2_ACCOUNTS_COUNT, RAYDIUM_DECREASE_LIQUIDITY_V2_DISCRIMINATOR, RAYDIUM_DECREASE_POOL_STATE_ACCOUNT_OFFSET, RAYDIUM_DECREASE_POSITION_STATE_ACCOUNT_OFFSET, RAYDIUM_DECREASE_USER_STATE_ACCOUNT_OFFSET, RAYDIUM_DECREASE_GLOBAL_STATE_TOKEN_ACCOUNT_0_OFFSET, RAYDIUM_DECREASE_GLOBAL_STATE_TOKEN_ACCOUNT_1_OFFSET, USER_STATE}, error::StrategyError, helpers::{build_decrease_liquidity_v2_metas, build_meteora_deposit_withdraw_metas, is_ata}, state::{GlobalState, KeeperState, LpTokenState, TokenDeployed, UserState}};


#[derive(AnchorDeserialize, AnchorSerialize, Clone)]
pub struct KeeperDecreaseLiquidityPositionArgs{
    /// The minimum amount to the meteora lp token to receive
    pub lp_amount_min:u64,
}

#[derive(Accounts)]
pub struct KeeperDecreaseLiquidityPositionAccounts<'info>{
    /// The keeper state, stores the keeper's key and credits    
    #[account(
        mut
    )]
    keeper_account:Account<'info, KeeperState>,

    // Here we don't bother passing in the accounts used by the called programs
    // we pass in all the accounts through remaining accounts
    // to avoid the overhead of deserializing it twice, e.g once here
    // converting it back to an `account_info`, and then deserializing it
    // again in the called programs.
    // Though we do make some checks assuming all accounts are in their proper position
    // which the called programs would also expect.
}

#[inline(never)]
pub fn keeper_decrease_liquidity_position_handler<'a, 'b, 'c, 'info>(
    ctx:Context<'a, 'b, 'c, 'info, KeeperDecreaseLiquidityPositionAccounts<'info>>, 
    args:KeeperDecreaseLiquidityPositionArgs
)->Result<()>{

    // The layout of the accounts passed into the `remaining_accounts` is as follows:-
    // 0..8 Meteora deposit accounts(token_(0/1)) (including the meteora vault program)
    // 8.. Raydium decrease liquidity accounts (including the raydium clmm program)
    // We repeat accounts when we pass them into the instruction.

    require_gte!(
        ctx.remaining_accounts.len(),
        METEORA_DEPOSIT_LIQUIDITY_ACCOUNTS_COUNT.add(
            RAYDIUM_DECREASE_LIQUIDITY_V2_ACCOUNTS_COUNT
        ),
        StrategyError::MissingRaydiumOrMeteoraAccounts
    );    

    let raydium_accounts = &ctx.remaining_accounts[(METEORA_DEPOSIT_LIQUIDITY_ACCOUNTS_COUNT)..];

    let user_state_account = &raydium_accounts[RAYDIUM_DECREASE_USER_STATE_ACCOUNT_OFFSET];

    let meteora_accounts = &ctx.remaining_accounts[..METEORA_DEPOSIT_LIQUIDITY_ACCOUNTS_COUNT];

    let global_state_account = &meteora_accounts[METEORA_DEPOSIT_GLOBAL_STATE_ACCOUNT_OFFSET];

    let mut user_state = UserState::try_deserialize(&mut &user_state_account.try_borrow_data()?[..])?;
    
    let global_state = GlobalState::try_deserialize(&mut &global_state_account.try_borrow_data()?[..])?;

    // Ensure we can perform this action
    require!(
        global_state.can_decrease_position(),
        StrategyError::UnauthorizedAction
    );

    // Ensure the position is not already deployed
    require!(
        !user_state.is_deployed(),
        StrategyError::PositionDeployed
    );
    
    // Decrease the liquidity from the position and get the 
    // token(one of the pair) in the global state token account
    let (liquidity, deposited_amount, current_token_offet, token_to_be_deployed) = 
        decrease_liquidity(
        &user_state,
        global_state_account.key, 
        raydium_accounts
    )?;
    
    // Deposit the token(one of the pair(same as above)) into the 
    // meteora vault to get lp tokens in the global state lp account
    let global_state_signer_seeds: &[&[&[u8]]] = &[&[
                GLOBAL_STATE,
                &[global_state.bump]
    ]];      

    let lp_amount = deposit_into_meteora_vault(
        &ctx.remaining_accounts[..METEORA_DEPOSIT_LIQUIDITY_ACCOUNTS_COUNT],
        global_state_account.key, 
        &raydium_accounts[current_token_offet].key, 
        deposited_amount,
        args.lp_amount_min, 
        global_state_signer_seeds
    )?;

    // Reward the bot with credits
    global_state.
        add_decrease_liquidity_credits_for_keeper(&mut ctx.accounts.keeper_account)?;

    user_state.set_deployed(liquidity, deposited_amount, lp_amount, token_to_be_deployed);

    // Save the user state
    user_state.set_into(user_state_account)
}

#[inline(never)]
pub fn deposit_into_meteora_vault(
    meteora_accounts:&[AccountInfo<'_>],
    global_state_key:&Pubkey,
    global_state_token_account_key:&Pubkey,
    token_amount:u64,
    lp_amount_min:u64,
    global_state_signer_seeds:&[&[&[u8]]]
)->Result<u64>{

    // We only pull out the relevant accounts we need for validation, the structure is taken from here:-
    //https://github.com/MeteoraAg/vault-sdk/blob/main/programs/vault/src/context.rs#L24

    // Check the global state account
    let global_state_account = &meteora_accounts[METEORA_DEPOSIT_GLOBAL_STATE_ACCOUNT_OFFSET];

    require_keys_eq!(
        *global_state_key,
        *global_state_account.key,
        StrategyError::InvalidGlobalStateAccount
    );

    // We only check the address here, we have checked ownership of the token account in
    // the decrease liquidity handler
    require_keys_eq!(
        *meteora_accounts[METEORA_DEPOSIT_GLOBAL_STATE_TOKEN_ACCOUNT_OFFSET].key,
        *global_state_token_account_key,
        StrategyError::InvalidTokenAccount
    );

    let lp_mint_account = &meteora_accounts[METEORA_DEPOSIT_LP_MINT_ACCOUNT_OFFSET];

    let global_state_lp_account = &meteora_accounts[METEORA_DEPOSIT_GLOBAL_STATE_LP_ACCOUNT_OFFSET];
    
    let global_state_lp_account_initial = 
    TokenAccount::try_deserialize(&mut &global_state_lp_account.try_borrow_data()?[..])?;
    
    // We check if it is the ata to avoid fragmenting liquidity
    if !is_ata(
            global_state_account.key, global_state_lp_account.key, 
            lp_mint_account.key
        ){
        return Err(StrategyError::InvalidTokenAccount.into());
    }

    // Serialize the discriminator & instruction data
    let mut data = Vec::with_capacity(24);

    (   METEORA_VAULT_DEPOSIT_DISCRIMINATOR, // Serialize the discriminator
        token_amount, // Serialize the token amount
        lp_amount_min // Serialize the minimum lp amount, the bot may not attempt to find it, but since it is just a 
                      // minimum we add it in anyways
    ).serialize(&mut data)?;

    let instruction = Instruction{
        program_id:METEORA_VAULT_PROGRAM,
        accounts:build_meteora_deposit_withdraw_metas(meteora_accounts),
        data
    };

    invoke_signed(
        &instruction, 
        meteora_accounts, 
        global_state_signer_seeds
    )?;

    let global_state_lp_account = &meteora_accounts[METEORA_DEPOSIT_GLOBAL_STATE_LP_ACCOUNT_OFFSET];

    let global_state_lp_account_after = 
    TokenAccount::try_deserialize(&mut &global_state_lp_account.try_borrow_data()?[..])?;

    Ok(global_state_lp_account_after.amount.sub(global_state_lp_account_initial.amount))
}

#[inline(never)]
pub fn decrease_liquidity<'a>(
    user_state:&UserState,
    global_state_key:&Pubkey,
    raydium_accounts:&[AccountInfo<'a>]
)->Result<(u128, u64, usize, TokenDeployed)>{

    // We only pull out the relevant accounts we need for validation, the structure is taken from here:-
    // https://github.com/raydium-io/raydium-clmm/blob/master/programs/amm/src/instructions/decrease_liquidity_v2.rs#L9
    
    let current_token_offset;
    let token_to_be_deployed;

    { 
        let pool_state_ref = &raydium_accounts[RAYDIUM_DECREASE_POOL_STATE_ACCOUNT_OFFSET].
            try_borrow_data()?
            [8..]; // Skip the discriminator
    
        // PoolState is zero copy
        let pool_state = bytemuck::from_bytes::<PoolState>(pool_state_ref);

        // First we check if the rewards account belong to the owner of the lp position 

        // The raydium program does not specify where the bitmap extension account is located
        // so we have to find it ourselves to skip it when checking the reward accounts

        let bitmap_extension_key = TickArrayBitmapExtension::key(pool_state.key());
        
        let remaining_accounts_iter = 
        raydium_accounts.iter().
        skip(RAYDIUM_DECREASE_LIQUIDITY_V2_ACCOUNTS_COUNT). // Skip of over the raydium accounts and program account, 
                                                    // use only the raydium remaining accounts
        filter(|account| (*account.key).ne(&bitmap_extension_key)); // Skip the bitmap account                

        // The recipient token accounts are expected to be in the 
        // second position for every 3 accounts while ignoring the bitmap account

        let mut token_account_iter = 
            remaining_accounts_iter.skip(1).step_by(3);

        while let Some(account) = token_account_iter.next(){

            // Check if the reward account is owned by the expected owner
            let recipient_account = TokenAccount::try_deserialize(&mut &account.try_borrow_data()?[..])?;
            require_keys_eq!(
                recipient_account.owner,
                user_state.user,
                StrategyError::InvalidTokenAccount
            );
        }
        
        
        // Check if the current tick is out of the user defined thresholds

        let lp_token_state = user_state.get_lp_token_state(pool_state.tick_current);

        (current_token_offset, token_to_be_deployed) = 
        match lp_token_state{
            LpTokenState::Token0 => {
                (RAYDIUM_DECREASE_GLOBAL_STATE_TOKEN_ACCOUNT_0_OFFSET, TokenDeployed::Token0)
            },
            LpTokenState::Token1 => {
                    (RAYDIUM_DECREASE_GLOBAL_STATE_TOKEN_ACCOUNT_1_OFFSET, TokenDeployed::Token1)
                },
            LpTokenState::NotOutOfRange => {
                    return Err(StrategyError::TickNotOutOfRange.into());
                }
        };

        // Ensure the ata we are depositing into belong to the global state

        let recipient_account_0 = &raydium_accounts[RAYDIUM_DECREASE_GLOBAL_STATE_TOKEN_ACCOUNT_0_OFFSET];
        
        let recipient_account_1 = &raydium_accounts[RAYDIUM_DECREASE_GLOBAL_STATE_TOKEN_ACCOUNT_1_OFFSET];
        
        // We check if it is the ata to avoid fragmenting liquidity
        if !(is_ata(
                global_state_key, recipient_account_0.key, 
                &pool_state.token_mint_0
            ) &&
            is_ata(
                global_state_key, recipient_account_1.key, 
                &pool_state.token_mint_1
            )){
                return Err(StrategyError::InvalidTokenAccount.into());
        }
    }
            
    // Now we proceed to make the removal of the liquidity

    let current_recipient_token_account = &raydium_accounts[current_token_offset];  
    
    // We deserialize it so we can get the amount that were deposited
    let current_recipient_token_account_before = 
        TokenAccount::try_deserialize(&mut &current_recipient_token_account.try_borrow_data()?[..])?;      
        
    // Raydium checks that the owner, mint, personal position state and pool are all bound
    
    let position_state = 
    PersonalPositionState::try_deserialize(
        &mut &raydium_accounts[RAYDIUM_DECREASE_POSITION_STATE_ACCOUNT_OFFSET].
        try_borrow_data()?[..]
    )?;
    

    // Serialize the discriminator & instruction data
    
    let mut data = Vec::with_capacity(40);
    
    (   RAYDIUM_DECREASE_LIQUIDITY_V2_DISCRIMINATOR, // Serialize the discriminator
        position_state.liquidity, // Serialize the liquidity
        0_u64,0_u64 // Serialize the minimums, here we don't set the minimums because slippage cannot
        // occur in the typical sense, from the moment the tick left the user's range
        // the amount of tokens they had in the pool because fixed, one of them is a certain 
        // amount while the other is zero.
    ).serialize(&mut data)?;

    let instruction = Instruction{
        program_id:RAYDIUM_CLMM_PROGRAM_ID,
        accounts: build_decrease_liquidity_v2_metas(raydium_accounts),
        data
    };

    let signer_seeds: &[&[&[u8]]] = &[&[
            USER_STATE,
            user_state.user_mint.as_ref(),
            &[user_state.bump]
    ]];

    invoke_signed(
        &instruction, 
        raydium_accounts,
        signer_seeds
        )?;

    let current_recipient_token_account = &raydium_accounts[current_token_offset];          

    let current_recipient_token_account_after = 
        TokenAccount::try_deserialize(&mut &current_recipient_token_account.try_borrow_data()?[..])?;   

    // Return the difference
    Ok((position_state.liquidity, current_recipient_token_account_after.amount.
        sub(current_recipient_token_account_before.amount), current_token_offset, token_to_be_deployed))
}