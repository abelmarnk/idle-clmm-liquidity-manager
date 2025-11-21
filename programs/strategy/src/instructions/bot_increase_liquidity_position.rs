use std::ops::{Add, Sub};
use anchor_lang::{prelude::*, solana_program::{instruction::Instruction, program::invoke_signed}};
use anchor_spl::token::{SetAuthority, TokenAccount, set_authority, spl_token::instruction::AuthorityType};
use raydium_amm_v3::{ID as RAYDIUM_CLMM_PROGRAM_ID, states::PoolState};
use crate::{constants::{GLOBAL_STATE, METEORA_VAULT_PROGRAM, METEORA_VAULT_WITHDRAW_DISCRIMINATOR, METEORA_WITHDRAW_GLOBAL_STATE_ACCOUNT_OFFSET, METEORA_WITHDRAW_GLOBAL_STATE_LP_ACCOUNT_OFFSET, METEORA_WITHDRAW_GLOBAL_STATE_TOKEN_ACCOUNT_OFFSET, METEORA_WITHDRAW_LIQUIDITY_ACCOUNTS_COUNT, METEORA_WITHDRAW_LP_MINT_ACCOUNT_OFFSET, RAYDIUM_INCREASE_GLOBAL_STATE_TOKEN_ACCOUNT_0_OFFSET, RAYDIUM_INCREASE_GLOBAL_STATE_TOKEN_ACCOUNT_1_OFFSET, RAYDIUM_INCREASE_LIQUIDITY_V2_ACCOUNTS_COUNT, RAYDIUM_INCREASE_LIQUIDITY_V2_DISCRIMINATOR, RAYDIUM_INCREASE_POOL_STATE_ACCOUNT_OFFSET, RAYDIUM_INCREASE_TOKEN_PROGRAM_ACCOUNT_OFFSET, RAYDIUM_INCREASE_USER_STATE_ACCOUNT_OFFSET, RAYDIUM_INCREASE_USER_STATE_NFT_ACCOUNT_OFFSET, USER_STATE}, error::StrategyError, helpers::{build_increase_liquidity_v2_metas, build_meteora_deposit_withdraw_metas, is_ata}, state::{GlobalState, KeeperState, TokenDeployed, UserState}};

#[derive(AnchorDeserialize, AnchorSerialize, Clone)]
pub struct KeeperIncreaseLiquidityPositionArgs{
    /// The minimum amount of the token to be gotten from meteora given our lp amount
    pub token_amount_min:u64,
}

#[derive(Accounts)]
pub struct KeeperIncreaseLiquidityPositionAccounts<'info>{
    /// The keeper state, stores the keeper's key and credits
    #[account(
        mut
    )]
    keeper_account:Account<'info, KeeperState>,

    #[account(
        mut
    )]
    user_state_account:Account<'info, UserState>
    // Here we don't bother passing in the accounts used by the called programs
    // we pass in all the accounts through remaining accounts
    // to avoid the overhead of deserializing it twice, e.g once here
    // converting it back to an `account_info`, and then deserializing it
    // again in the called programs.
    // Though we do make some checks assuming all accounts are in their proper position
    // which the called programs would also expect.
}

#[inline(never)]
pub fn keeper_increase_liquidity_position_handler<'a, 'b, 'c, 'info>(
    ctx:Context<'a, 'b, 'c, 'info, KeeperIncreaseLiquidityPositionAccounts<'info>>,
    args:KeeperIncreaseLiquidityPositionArgs
)->Result<()>{
    // The layout of the accounts passed into the `remaining_accounts` is as follows:-
    // 0..8 Meteora deposit accounts(token_(0/1)) (including the meteora vault program)
    // 8.. Raydium decrease liquidity accounts (including the raydium clmm program)
    // We repeat accounts when we pass them into the instruction.

    require_gte!(
        ctx.remaining_accounts.len(),
        METEORA_WITHDRAW_LIQUIDITY_ACCOUNTS_COUNT.add(
            RAYDIUM_INCREASE_LIQUIDITY_V2_ACCOUNTS_COUNT
        ),
        StrategyError::MissingRaydiumOrMeteoraAccounts
    );    

    let raydium_accounts = &ctx.remaining_accounts[METEORA_WITHDRAW_LIQUIDITY_ACCOUNTS_COUNT..];
    let meteora_accounts = &ctx.remaining_accounts[..METEORA_WITHDRAW_LIQUIDITY_ACCOUNTS_COUNT];

    let global_state_account = &meteora_accounts[METEORA_WITHDRAW_GLOBAL_STATE_ACCOUNT_OFFSET];
    let global_state = GlobalState::try_deserialize(&mut &global_state_account.try_borrow_data()?[..])?;
   
   let user_state_account = &mut ctx.accounts.user_state_account;

    // Ensure we can perform this action
    require!(
        global_state.can_increase_position(),
        StrategyError::UnauthorizedAction
    );

    // Ensure the position is deployed
    require!(
        user_state_account.is_deployed(),
        StrategyError::PositionNotDeployed
    );
   
    // Withdraw from the meteora vaults into the global state token accounts
    let global_state_seeds: &[&[&[u8]]] = &[&[
        GLOBAL_STATE,
        &[global_state.bump]
    ]];

    let withdraw_amount = withdraw_from_meteora_vault(
        meteora_accounts,
        global_state_account.key,
        user_state_account.lp_amount,
        args.token_amount_min,
        global_state_seeds
    )?;
   
    // Increase the liquidity of the position
    let expected_token_account = &meteora_accounts[METEORA_WITHDRAW_GLOBAL_STATE_TOKEN_ACCOUNT_OFFSET];

    let withdraw_amount = global_state.
        get_amount(
            user_state_account.amount_deposited_into_vault,
            withdraw_amount
        )?;

    let user_state_seeds: &[&[&[u8]]] = &[&[
        USER_STATE,
        user_state_account.user_mint.as_ref(),
        &[user_state_account.bump]
    ]];

    let is_out_of_range = increase_liquidity(
            raydium_accounts,
            user_state_account,
            expected_token_account,
            withdraw_amount,
            user_state_seeds,
            global_state_seeds,
            false
    )?;

    // Reward the bot with credits
    global_state.
        add_increase_liquidity_credits_for_keeper(&mut ctx.accounts.keeper_account, is_out_of_range)?;
   
    user_state_account.set_not_deployed();

    Ok(())
}

#[inline(never)]
pub fn withdraw_from_meteora_vault<'info>(
    meteora_accounts:&[AccountInfo<'info>],
    global_state_key:&Pubkey,
    lp_amount:u64,
    token_amount_min:u64,
    signer_seeds:&[&[&[u8]]]
)->Result<u64>{
    // We only pull out the relevant accounts we need for validation, the structure is taken from here:-
    //https://github.com/MeteoraAg/vault-sdk/blob/main/programs/vault/src/context.rs#L24

    // Ensure the ata we are depositing into belongs to the global state
    let global_state_token_account = 
        &meteora_accounts[METEORA_WITHDRAW_GLOBAL_STATE_TOKEN_ACCOUNT_OFFSET];
    let global_state_token_account_initial =
        TokenAccount::try_deserialize(&mut &global_state_token_account.try_borrow_data()?[..])?;
       
    if !is_ata(
            global_state_key, global_state_token_account.key,
            &global_state_token_account_initial.mint
        ){
        return Err(StrategyError::InvalidTokenAccount.into());
    }
    // Ensure the ata we a pulling from belongs to the global state
    let lp_mint_account = &meteora_accounts[METEORA_WITHDRAW_LP_MINT_ACCOUNT_OFFSET];
    let global_state_lp_account = &meteora_accounts[METEORA_WITHDRAW_GLOBAL_STATE_LP_ACCOUNT_OFFSET];
   
    if !is_ata(
            global_state_key, global_state_lp_account.key,
            lp_mint_account.key
        ){
        return Err(StrategyError::InvalidTokenAccount.into());
    }

    // Serialize the discriminator & instruction data
    let mut data = Vec::with_capacity(24);

    ( METEORA_VAULT_WITHDRAW_DISCRIMINATOR, // Serialize the discriminator
        lp_amount, // Serialize the lp token amount
        token_amount_min // Serialize the minimum token amount
    ).serialize(&mut data)?;

    let instruction = Instruction{
        program_id:METEORA_VAULT_PROGRAM,
        accounts:build_meteora_deposit_withdraw_metas(meteora_accounts),
        data
    };

    invoke_signed(
        &instruction,
        meteora_accounts,
        signer_seeds
    )?;

    let global_state_token_account = 
        &meteora_accounts[METEORA_WITHDRAW_GLOBAL_STATE_TOKEN_ACCOUNT_OFFSET];

    let global_state_token_account_after =
        TokenAccount::try_deserialize(&mut &global_state_token_account.try_borrow_data()?[..])?;
   
    // Return the difference
    Ok(global_state_token_account_after.amount.sub(global_state_token_account_initial.amount))
}

#[inline(never)]
pub fn increase_liquidity<'info>(
    raydium_accounts:&[AccountInfo<'info>],
    user_state_account:&Account<'info, UserState>,
    expected_token_account:&AccountInfo<'_>,
    token_amount:u64,
    user_state_seeds:&[&[&[u8]]],
    global_state_seeds:&[&[&[u8]]],
    // If the user chooses to force it out of the protocol by closing their
    // position then we don't bother checking if it is within range, and if
    // required we pull from the reserves to complete the return back into raydium
    // read the comment where the token amounts are set for more info
    force_pull:bool 
)->Result<bool>{
    // We only pull out the relevant accounts we need for validation, the structure is taken from here:-
    // https://github.com/raydium-io/raydium-clmm/blob/master/programs/amm/src/instructions/increase_liquidity_v2.rs#L9
   
    let pool_state_account = &raydium_accounts[RAYDIUM_INCREASE_POOL_STATE_ACCOUNT_OFFSET];
    let global_state_account = &raydium_accounts[RAYDIUM_INCREASE_USER_STATE_ACCOUNT_OFFSET];

    let liquidity;
    let token_0_amount;
    let token_1_amount;
    let base_flag;
    let is_within_range;
    let is_within_threshold_range;

    {
        let pool_state_data = &pool_state_account.
        try_borrow_data()?
        [8..]; // Skip the discriminator

        // PoolState is `zero_copy`
        let pool_state = bytemuck::from_bytes::<PoolState>(pool_state_data);
           
        is_within_range = user_state_account.
            is_tick_within_range(pool_state.tick_current);
        is_within_threshold_range = user_state_account.
            is_tick_within_in_threshold_range(pool_state.tick_current);

        if (force_pull && !is_within_threshold_range) || (is_within_threshold_range && !is_within_range){
            let global_token_account_0 = &raydium_accounts[RAYDIUM_INCREASE_GLOBAL_STATE_TOKEN_ACCOUNT_0_OFFSET];
            let global_token_account_1 = &raydium_accounts[RAYDIUM_INCREASE_GLOBAL_STATE_TOKEN_ACCOUNT_1_OFFSET];

            liquidity = 0;

            // Though we expect the tick to come back within range we still expect it to be out of
            // range for the user's position but heading there under that assumption
            // it would be the case that only one token is accepted the original token deposited,
            // but that may not be the case
            match user_state_account.token_deployed{
                TokenDeployed::Token0 => {
                    // We only check the address here, we have checked ownership of the token account in
                    // the withdraw handler
                    require_keys_eq!(
                        *global_token_account_0.key,
                        *expected_token_account.key,
                        StrategyError::InvalidTokenAccount
                    );
                    // Ensure the token account belongs to the global state
                    if !is_ata(
                        global_state_account.key, global_token_account_1.key,
                        &pool_state.token_mint_1
                    ){
                        return Err(StrategyError::InvalidTokenAccount.into());
                    }

                    (token_0_amount, token_1_amount, base_flag) = 
                        (token_amount, 0_u64, Some(true));
                    
                },
                TokenDeployed::Token1 => {
                    // We only check the address here, we have checked ownership of the token account in
                    // the withdraw handler
                    require_keys_eq!(
                        *global_token_account_1.key,
                        *expected_token_account.key,
                        StrategyError::InvalidTokenAccount
                    );
                    // Ensure the token account belongs to the global state
                    if !is_ata(
                        global_state_account.key, global_token_account_0.key,
                        &pool_state.token_mint_0
                    ){
                        return Err(StrategyError::InvalidTokenAccount.into());
                    }
                    
                    (token_0_amount, token_1_amount, base_flag) = 
                        (0_u64, token_amount, Some(false));
                },
                // The check for being deployed is made in the instruction that calls this
                TokenDeployed::NoTokenDeployed => unreachable!()
            }
        } else if is_within_range {
            liquidity = user_state_account.liquidity;
            
            (token_0_amount, token_1_amount, base_flag) = 
                (0, 0, None);
        } else {
            return Err(StrategyError::TickNotWithinRange.into());
        }
    }
    let position_nft_account = &raydium_accounts[RAYDIUM_INCREASE_USER_STATE_NFT_ACCOUNT_OFFSET];
    let token_program_account = &raydium_accounts[RAYDIUM_INCREASE_TOKEN_PROGRAM_ACCOUNT_OFFSET];

    // Temporarily set the authority of the NFT account to the global state account
    set_authority(
        CpiContext::new_with_signer(
            token_program_account.clone(),
            SetAuthority {
                account_or_mint: position_nft_account.clone(),
                current_authority: user_state_account.to_account_info(),
            },
            user_state_seeds,
        ),
        AuthorityType::AccountOwner,
        Some(global_state_account.key()),
    )?;

    // Serialize the discriminator & instruction data
    let mut data = Vec::with_capacity(44);
    ( RAYDIUM_INCREASE_LIQUIDITY_V2_DISCRIMINATOR, // Serialize the discriminator
        liquidity, 
        token_0_amount, token_1_amount,                        
        base_flag
    ).serialize(&mut data)?;
       
    let instruction = Instruction{
            program_id:RAYDIUM_CLMM_PROGRAM_ID,
            accounts: build_increase_liquidity_v2_metas(raydium_accounts),
            data
    };

    invoke_signed(
        &instruction,
        raydium_accounts,
        global_state_seeds
    )?;

    // Set the authority of the NFT account back to the user state account
    set_authority(
        CpiContext::new_with_signer(
            token_program_account.clone(),
            SetAuthority {
                account_or_mint: position_nft_account.clone(),
                current_authority: global_state_account.clone(),
            },
            global_state_seeds,
        ),
        AuthorityType::AccountOwner,
        Some(user_state_account.key()),
    )?;

    Ok(!is_within_range)
}

/*
let (token_amount_0, token_amount_1, base_flag) =
        {
            let pool_state_data = &pool_state_account.
            try_borrow_data()?
            [8..]; // Skip the discriminator

            // PoolState is `zero_copy`
            let pool_state = bytemuck::from_bytes::<PoolState>(pool_state_data);
            
            require!(
                force_pull ||
                user_state_account.is_tick_within_range(pool_state.tick_current),
                StrategyError::TickNotWithinRange
            );

            let other_amount = if force_pull {u64::MAX} else {0};

            // Get the arguments for the raydium instruction
            let global_token_account_0 = &raydium_accounts[RAYDIUM_INCREASE_GLOBAL_STATE_TOKEN_ACCOUNT_0_OFFSET];
            let global_token_account_1 = &raydium_accounts[RAYDIUM_INCREASE_GLOBAL_STATE_TOKEN_ACCOUNT_1_OFFSET];

            // Though we expect the tick to come back within range we still expect it to be out of
            // range for the user's position but heading there under that assumption
            // it would be the case that only one token is accepted the original token deposited,
            // but that may not be the case, read the other comments below
            match user_state_account.token_deployed{
                TokenDeployed::Token0 => {
                    // We only check the address here, we have checked ownership of the token account in
                    // the withdraw handler
                    require_keys_eq!(
                        *global_token_account_0.key,
                        *expected_token_account.key,
                        StrategyError::InvalidTokenAccount
                    );
                    // Ensure the token account belongs to the global state
                    if !is_ata(
                        global_state_account.key, global_token_account_1.key,
                        &pool_state.token_mint_1
                    ){
                        return Err(StrategyError::InvalidTokenAccount.into());
                    }
                    (token_amount,
                        other_amount, // The value of zero only works if the bot is guaranteed to act
                           // fast enough to put the token 0 back in before it goes into the user's
                           // raydium range, if they do then this would always work, if they don't 
                           // then it would not be possible for the bot to deposit the liquidity
                           // as raydium would require some of token 1 to be deposited, but setting 0
                           // here makes that not possible, it can be relaxed by setting it to u64::max
                           // and providing token 1 from the reserves while the reserves would hold
                           // the remaning token0, since the token0 would be equivalent or greater in value
                           // it would not result in a loss to the protocol. 
                        true)
                },
                TokenDeployed::Token1 => {
                    // We only check the address here, we have checked ownership of the token account in
                    // the withdraw handler
                    require_keys_eq!(
                        *global_token_account_1.key,
                        *expected_token_account.key,
                        StrategyError::InvalidTokenAccount
                    );
                    // Ensure the token account belongs to the global state
                    if !is_ata(
                        global_state_account.key, global_token_account_0.key,
                        &pool_state.token_mint_0
                    ){
                        return Err(StrategyError::InvalidTokenAccount.into());
                    }
                    (other_amount, // The value of zero only works if the bot is guaranteed to act
                        // fast enough to put the token1 back in before it goes into the user's
                        // raydium range, if they do then this would always work, if they don't 
                        // then it would not be possible for the bot to deposit the liquidity
                        // as raydium would require some of token0 to be deposited, but setting 0
                        // here makes that not possible, it can be relaxed by setting it to u64::max
                        // and providing token0 from the reserves while the reserves would hold
                        // the remaning token1, since the token1 would be equivalent or greater in value
                        // it would not result in a loss to the protocol.
                     token_amount, 
                     false)
                },
                TokenDeployed::NoTokenDeployed => unreachable!()
            }
        };
*/