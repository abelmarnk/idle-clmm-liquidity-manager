/*use anchor_lang::{prelude::*, system_program::{Transfer, transfer}};
use anchor_spl::{associated_token::AssociatedToken, token_interface::{Mint, TokenAccount, TokenInterface}};
use raydium_amm_v3::{ID, states::{PersonalPositionState, PoolState}};

use crate::{constants::USER_STATE, helpers::transfer_token, state::{GlobalState, WhitelistState}};
use crate::state::UserState;
use crate::error::StrategyError;

// const RAYDIUM_CLMM_PROGRAM_ID:Pubkey = pubkey!("DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH");

#[derive(AnchorDeserialize, AnchorSerialize, Clone)]
pub struct UserCreatePositionFromRaydiumArgs{

    // The tick lower bound that has to be hit before the increase action from
    // the bot can be triggered
    pub tick_lower_index_in_threshold: i32,

    // The tick upper bound that has to be hit before the increase action from
    // the bot can be triggered    
    pub tick_upper_index_in_threshold: i32,

    // The tick lower bound that has to be hit before the decrease action from
    // the bot can be triggered
    pub tick_lower_index_out_threshold: i32,

    // The tick upper bound that has to be hit before the decrease action from
    // the bot can be triggered
    pub tick_upper_index_out_threshold: i32
}

fn print_owner<'info>(account:&Account<'info, PersonalPositionState>)->bool{
    msg!("Owner: {}", account.to_account_info().owner);
    true
}

#[derive(Accounts)]
pub struct UserCreatePositionFromRaydiumAccounts<'info>{
    /// The payer paying for the account creation as well as the base deposit
    #[account(
        mut
    )]
    pub payer:Signer<'info>,

    /// The user that owns of this position
    pub user:Signer<'info>,

    /// The user mint for the NFT
    #[account(
        owner = token_program.key()
    )]
    pub user_mint: Box<InterfaceAccount<'info, Mint>>,    

    /// The user token account for the position owner
    #[account(
        mut,
        owner = token_program.key()
    )]    
    pub user_token_account:Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: The raydium owned account that stores information about the owner's
    /// position

    pub position_state: UncheckedAccount<'info>,

    /// CHECK: The raydium owned account that stores information about the pool
    pub pool_state: UncheckedAccount<'info>,

    /// The user state, it stores relevant info about the user's position in this program
    #[account(
        init,
        payer = payer,
        space = UserState::DISCRIMINATOR.len() + UserState::INIT_SPACE,
        seeds = [USER_STATE, user_mint.key().as_ref()],
        bump
    )]
    pub user_state: Account<'info, UserState>,

    /// This is the token account used to store the NFT taken from the user
    #[account(
        init,
        payer = payer,
        associated_token::mint = user_mint,
        associated_token::authority = user_state,
        associated_token::token_program = token_program
    )]
    pub user_state_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub mint_0_whitelist:Account<'info, WhitelistState>,

    pub mint_1_whitelist:Account<'info, WhitelistState>,

    /// The global state, stores global wide config
    pub global_state: Account<'info, GlobalState>,

    /// The token program required for transferring tokens
    pub token_program: Interface<'info, TokenInterface>,

    /// The system program required for creating accounts
    pub system_program: Program<'info, System>,

    /// The associated token program required for creating atas
    pub associated_token_program: Program<'info, AssociatedToken>
}

#[inline(never)]
pub fn user_create_position_from_raydium_handler(
    ctx:Context<UserCreatePositionFromRaydiumAccounts>, 
    args:UserCreatePositionFromRaydiumArgs
)->Result<()>{

    require!(
        ctx.accounts.global_state.can_create_position(),
        StrategyError::ProgramNotOpenToCreatingPositions
    );

    let pool_ref = &ctx.accounts.pool_state.try_borrow_data()?[8..];

    let pool_state = bytemuck::from_bytes::<PoolState>(&pool_ref);

    let position_state = 
        PersonalPositionState::try_deserialize(&mut ctx.accounts.position_state.try_borrow_data()?.as_ref())?;

    require_keys_eq!(
        position_state.pool_id,
        pool_state.key(),
        StrategyError::InvalidPool
    );

    require_keys_eq!(
        position_state.nft_mint,
        ctx.accounts.user_mint.key(),
        StrategyError::InvalidNFTMint
    );
    
    // Check if the destination mints are actually supported
    require_keys_eq!(
        ctx.accounts.mint_0_whitelist.mint, 
        pool_state.token_mint_0, 
        StrategyError::DestinationMintNotWhitelisted
    );

    require_keys_eq!(
        ctx.accounts.mint_1_whitelist.mint, 
        pool_state.token_mint_1, 
        StrategyError::DestinationMintNotWhitelisted
    );    
    
    ctx.accounts.user_state.initialize(
        ctx.accounts.user.key,
        args.tick_lower_index_in_threshold,
        args.tick_upper_index_in_threshold,
        args.tick_lower_index_out_threshold,
        args.tick_upper_index_out_threshold,
        &ctx.accounts.user_mint.key(), 
        ctx.bumps.user_state
    );

    // Transfer the NFT from the user
    transfer_token(
        ctx.accounts.user.to_account_info(),                     
        ctx.accounts.user_token_account.to_account_info(), 
        ctx.accounts.user_mint.to_account_info(),                
        ctx.accounts.user_state_token_account.to_account_info(),  
        ctx.accounts.token_program.to_account_info(),             
        1,                                                       
        0,                                                     
        &[],                                               
    )?;

    // Transfer the base deposit from the user
    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(), 
            Transfer{
                from:ctx.accounts.payer.to_account_info(),
                to:ctx.accounts.user_state.to_account_info()
            }
        ), 
        ctx.accounts.global_state.base_deposit   
    )
}
*/

// /*
use anchor_lang::{prelude::*, system_program::{Transfer, transfer}};
use anchor_spl::{associated_token::AssociatedToken, token_interface::{Mint, TokenAccount, TokenInterface}};
use raydium_amm_v3::{states::{PersonalPositionState, PoolState}};

use crate::{constants::USER_STATE, helpers::transfer_token, state::{GlobalState, WhitelistState}};
use crate::state::UserState;
use crate::error::StrategyError;

// const RAYDIUM_CLMM_PROGRAM_ID:Pubkey = pubkey!("DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH");

#[derive(AnchorDeserialize, AnchorSerialize, Clone)]
pub struct UserCreatePositionFromRaydiumArgs{

    // The tick lower bound that has to be hit before the increase action from
    // the bot can be triggered
    pub tick_lower_index_in_threshold: i32,

    // The tick upper bound that has to be hit before the increase action from
    // the bot can be triggered    
    pub tick_upper_index_in_threshold: i32,

    // The tick lower bound that has to be hit before the decrease action from
    // the bot can be triggered
    pub tick_lower_index_out_threshold: i32,

    // The tick upper bound that has to be hit before the decrease action from
    // the bot can be triggered
    pub tick_upper_index_out_threshold: i32
}


#[derive(Accounts)]
pub struct UserCreatePositionFromRaydiumAccounts<'info>{
    /// The payer paying for the account creation as well as the base deposit
    #[account(
        mut
    )]
    pub payer:Signer<'info>,

    /// The user that owns of this position
    pub user:Signer<'info>,

    /// The user mint for the NFT
    #[account(
        owner = token_program.key()
    )]
    pub user_mint: Box<InterfaceAccount<'info, Mint>>,    

    /// The user token account for the position owner
    #[account(
        mut,
        owner = token_program.key()
    )]    
    pub user_token_account:Box<InterfaceAccount<'info, TokenAccount>>,

    /// The raydium owned account that stores information about the owner's
    // position
    pub position_state: Box<Account<'info, PersonalPositionState>>,

    /// The raydium owned account that stores information about the pool
    pub pool_state: AccountLoader<'info, PoolState>,

    /// The user state, it stores relevant info about the user's position in this program
    #[account(
        init,
        payer = payer,
        space = UserState::DISCRIMINATOR.len() + UserState::INIT_SPACE,
        seeds = [USER_STATE, user_mint.key().as_ref()],
        bump
    )]
    pub user_state: Account<'info, UserState>,

    /// This is the token account used to store the NFT taken from the user
    #[account(
        init,
        payer = payer,
        associated_token::mint = user_mint,
        associated_token::authority = user_state,
        associated_token::token_program = token_program
    )]
    pub user_state_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub mint_0_whitelist:Account<'info, WhitelistState>,

    pub mint_1_whitelist:Account<'info, WhitelistState>,

    /// The global state, stores global wide config
    pub global_state: Account<'info, GlobalState>,

    /// The token program required for transferring tokens
    pub token_program: Interface<'info, TokenInterface>,

    /// The system program required for creating accounts
    pub system_program: Program<'info, System>,

    /// The associated token program required for creating atas
    pub associated_token_program: Program<'info, AssociatedToken>
}

#[inline(never)]
pub fn user_create_position_from_raydium_handler(
    ctx:Context<UserCreatePositionFromRaydiumAccounts>, 
    args:UserCreatePositionFromRaydiumArgs
)->Result<()>{

    require!(
        ctx.accounts.global_state.can_create_position(),
        StrategyError::ProgramNotOpenToCreatingPositions
    );

    let pool_state = ctx.accounts.pool_state.load()?;

    require_keys_eq!(
        ctx.accounts.position_state.pool_id,
        pool_state.key(),
        StrategyError::InvalidPool
    );

    require_keys_eq!(
        ctx.accounts.position_state.nft_mint,
        ctx.accounts.user_mint.key(),
        StrategyError::InvalidNFTMint
    );
    
    // Check if the destination mints are actually supported
    require_keys_eq!(
        ctx.accounts.mint_0_whitelist.mint, 
        pool_state.token_mint_0, 
        StrategyError::DestinationMintNotWhitelisted
    );

    require_keys_eq!(
        ctx.accounts.mint_1_whitelist.mint, 
        pool_state.token_mint_1, 
        StrategyError::DestinationMintNotWhitelisted
    );    


    require!(
        ctx.accounts.position_state.tick_lower_index.gt(&args.tick_lower_index_in_threshold)
        &&
        ctx.accounts.position_state.tick_lower_index.gt(&args.tick_lower_index_out_threshold)
        && 
        args.tick_lower_index_out_threshold.le(&args.tick_lower_index_in_threshold),
        StrategyError::InvalidTickThresholdProvided
    );

    require!(
        ctx.accounts.position_state.tick_upper_index.lt(&args.tick_lower_index_in_threshold)
        &&
        ctx.accounts.position_state.tick_lower_index.lt(&args.tick_lower_index_out_threshold)
        && 
        args.tick_upper_index_out_threshold.ge(&args.tick_upper_index_in_threshold),
        StrategyError::InvalidTickThresholdProvided
    );

    ctx.accounts.user_state.initialize(
        ctx.accounts.user.key,
        ctx.accounts.position_state.tick_lower_index,
        ctx.accounts.position_state.tick_upper_index,
        args.tick_lower_index_in_threshold,
        args.tick_upper_index_in_threshold,
        args.tick_lower_index_out_threshold,
        args.tick_upper_index_out_threshold,
        &ctx.accounts.user_mint.key(), 
        ctx.bumps.user_state
    );

    // Transfer the NFT from the user
    transfer_token(
        ctx.accounts.user.to_account_info(),                     
        ctx.accounts.user_token_account.to_account_info(), 
        ctx.accounts.user_mint.to_account_info(),                
        ctx.accounts.user_state_token_account.to_account_info(),  
        ctx.accounts.token_program.to_account_info(),             
        1, // NFT                                                       
        0, // NFT                                                    
        &[],                                               
    )?;

    // Transfer the base deposit from the user
    transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(), 
            Transfer{
                from:ctx.accounts.payer.to_account_info(),
                to:ctx.accounts.user_state.to_account_info()
            }
        ), 
        ctx.accounts.global_state.base_deposit   
    )
}

// */